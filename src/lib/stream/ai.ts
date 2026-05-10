// cspell:words TTFT lstrip
import nunjucks from 'nunjucks'
import { RateLimitError } from 'openai'

import { Message } from '../ai'
import { createStubStepTracer, StepTrace } from '../bosun'
import { PromptFile } from '../prompt-fs'
import { defaultFilter } from './filter'
import {
    AIStreamEngine,
    ProgrammaticFilter,
    ResponseChunk,
    StreamingEngineConfig,
    Transcript,
    WorkflowConfig,
} from './interfaces'
import { stdPrompt } from '../bosun/step-registry'
import { Logger } from '../interfaces'

export function createAIStreamEngine(cfg: StreamingEngineConfig): AIStreamEngine {
    function createWorkflow<CTX>({
        name,
        prompt,
        model,
        filter = defaultFilter,
        onError,
    }: WorkflowConfig<CTX>) {
        cfg.logger.debug('streamAiEngine.createWorkflow')
        const stepTracer = cfg.stepTracer || createStubStepTracer(cfg.logger)
        cfg.stepRegistry.addStep({
            type: 'streaming-response',
            name,
            prompt: stdPrompt(prompt),
        })

        async function run(messages: Message[], ctx: CTX) {
            let streamCancelled = false
            return new ReadableStream<ResponseChunk>({
                cancel: (reason) => {
                    cfg.logger.debug(`streamingWorkflow.run cancelled: ${reason}`)
                    streamCancelled = true
                },
                start: async (controller) => {
                    try {
                        const stream = await generateResponseStream(messages, ctx)
                        for await (const chunk of stream) {
                            if (streamCancelled) return
                            controller.enqueue(chunk)
                        }
                        if (streamCancelled) return
                        controller.close()
                    } catch (e) {
                        if (streamCancelled) {
                            cfg.logger.debug(
                                'streamingWorkflow.run will not propagate error due to stream cancellation',
                                e,
                            )
                            return
                        }
                        controller.error(e)
                        if (e instanceof RateLimitError && cfg.onQuotaExceeded) {
                            await cfg.onQuotaExceeded(e)
                        }
                        await onError(e as Error | string, ctx)
                    }
                },
            })
        }

        async function generateResponseStream(
            messages: Message[],
            ctx: CTX,
        ): Promise<ReadableStream<ResponseChunk>> {
            const runId = crypto.randomUUID()
            cfg.logger.debug(`streamingWorkflow.run runId: ${runId}`)
            const startTime = performance.now()
            const transcript = createTranscript(cfg.logger, messages)

            let currentFilter: ProgrammaticFilter | null = null
            let filteredTokens: string[] = []

            // Create step trace for telescope
            const mainStepTrace: StepTrace = {
                workflowId: name,
                workflowRunId: runId,
                name: name,
                model: String(model.getOptions()),
                createdAt: Date.now(),
                response: '',
            }

            const renderedPrompt = await renderPrompt(prompt, ctx)
            const stringifiedConversation = transcript.toString()

            mainStepTrace.renderedPrompt = renderedPrompt
            mainStepTrace.stringifiedConversation = stringifiedConversation

            let mainStepStream: ReadableStream<string>
            try {
                mainStepStream = await model.generateStream(renderedPrompt, stringifiedConversation)
            } catch (error) {
                cfg.logger.error('AI Engine Stream: LLM error', { error })
                if (mainStepTrace) {
                    mainStepTrace.error = error instanceof Error ? error : new Error(String(error))
                    cfg.stepTracer?.addStepTrace(mainStepTrace)
                    await cfg.stepTracer?.flush()
                }
                throw error
            }
            cfg.logger.debug(
                `[MARK] stream created: ${(performance.now() - startTime).toFixed(2)}ms`,
            )

            let measureTtft = true
            let streamCancelled = false
            return new ReadableStream<ResponseChunk>({
                cancel: (reason) => {
                    cfg.logger.debug(
                        `streamingWorkflow.generateResponseStream cancelled: ${reason}`,
                    )
                    streamCancelled = true
                },
                async start(controller) {
                    cfg.logger.debug('streamingWorkflow.run: starting main stream')
                    for await (const chunk of mainStepStream) {
                        if (measureTtft) {
                            cfg.logger.debug(
                                `[MARK] TTFT: ${(performance.now() - startTime).toFixed(2)}ms`,
                            )
                            measureTtft = false
                        }
                        const delta = chunk
                        if (!delta) {
                            continue
                        }

                        let tokensToRelease: string[] = []

                        if (currentFilter) {
                            filteredTokens.push(delta)
                            const filterResult = currentFilter.onNewToken(
                                transcript,
                                filteredTokens,
                            )
                            if (filterResult.action === 'RELEASE_TOKENS') {
                                cfg.logger.debug(
                                    'streamingWorkflow.run: programmatic filter releasing tokens: ',
                                    JSON.stringify(filterResult.tokens),
                                )
                                tokensToRelease = filterResult.tokens
                                currentFilter = null
                                filteredTokens = []
                            }
                        } else if (filter?.shouldStartFiltering(transcript, delta)) {
                            filteredTokens = [delta]
                            currentFilter = filter
                            cfg.logger.debug(
                                'streamingWorkflow.run: programmatic filter is applied on token: ',
                                delta,
                            )
                        } else {
                            tokensToRelease = [delta]
                        }
                        releaseMainStreamTokens(tokensToRelease)
                    }

                    if (currentFilter) {
                        // stream has ended, but the filter still has some tokens to release
                        releaseMainStreamTokens(
                            currentFilter.onStreamEnd(transcript, filteredTokens).tokensToRelease,
                        )
                        currentFilter = null
                        filteredTokens = []
                    }

                    function releaseMainStreamTokens(tokens: string[]) {
                        for (const token of tokens) {
                            if (streamCancelled) {
                                break
                            }
                            transcript.responseChunks.push({ role: 'agent', delta: token })
                            controller.enqueue({ role: 'agent', delta: token })
                        }
                    }

                    cfg.logger.debug('streamingWorkflow.run: markMainResponseFinished', {
                        elapsedMs: (performance.now() - startTime).toFixed(2),
                    })
                    transcript.markMainResponseFinished()

                    // Add step trace and flush to telescope
                    cfg.stepTracer?.addStepTrace(mainStepTrace)
                    await cfg.stepTracer?.flush()
                    if (cfg.conversationalTracer) {
                        try {
                            const ctxWithState = ctx as any
                            const rawConversationId =
                                ctxWithState?.state?.callId ?? ctxWithState?.callId
                            const conversationId =
                                typeof rawConversationId === 'string' && rawConversationId !== ''
                                    ? rawConversationId
                                    : undefined
                            cfg.conversationalTracer.addConversationalTrace({
                                conversationId,
                                eventName: 'finished-main-streaming-step',
                                role: 'agent',
                                medium: 'phone',
                                content: transcript.currentResponse,
                                createdAt: Date.now(),
                            })
                            await cfg.conversationalTracer.flush()
                        } catch (err) {
                            cfg.logger.error('Failed to write conversational trace', { err })
                        }
                    }
                    if (!streamCancelled) {
                        controller.close()
                    }
                    await stepTracer.flush()
                },
            })
        }

        async function renderPrompt(prompt: string | PromptFile, context?: CTX) {
            cfg.logger.debug('Streaming AI, CONTEXT:', context)
            const template = typeof prompt === 'string' ? prompt : await prompt.content()
            if (context) {
                cfg.logger.debug('Loaded context: ', context)
                nunjucks.configure({
                    autoescape: true,
                    trimBlocks: true,
                    lstripBlocks: true,
                })
                return nunjucks.renderString(template, context)
            }
            return template
        }

        return {
            run,
        }
    }

    return {
        createWorkflow,
    }
}

function createTranscript(logger: Logger, initialMessages: Message[]): Transcript {
    let finished = false
    const messages = [...initialMessages]
    const directivesFormatter = (msg: Message) => `${msg.sender}: ${msg.text}`
    const currentResponseFormatter = (partial: string) => `Current response: ${partial}`
    const responseTokens: ResponseChunk[] = []
    const names: Record<Message['sender'], string> = {
        agent: 'Agent',
        user: 'User',
        system: 'System',
    }

    return {
        responseChunks: responseTokens,

        get currentResponse() {
            return responseTokens
                .filter((token) => token.role === 'agent')
                .map((token) => token?.delta)
                .join('')
        },

        get mainResponseFinished() {
            return finished
        },

        get messages() {
            return initialMessages
        },

        markMainResponseFinished() {
            logger.debug('Conversation, markMainResponseFinished')
            finished = true
        },

        toString(ignoreDirectives = false) {
            const serializedMessages = messages
                .map((msg) => {
                    if (msg.sender === 'system') {
                        return ignoreDirectives ? null : directivesFormatter(msg)
                    }
                    return `${names[msg.sender]}: ${msg.text}`
                })
                .filter((line) => line !== null)
                .join('\n')

            if (responseTokens.length === 0) {
                return serializedMessages
            }

            return serializedMessages + '\n' + currentResponseFormatter(this.currentResponse)
        },

        getConversation() {
            return messages
        },
    }
}
