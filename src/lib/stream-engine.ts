import fs from 'node:fs'
import { join, resolve } from 'node:path'
import { ReadableStream } from 'node:stream/web'

import nunjucks from 'nunjucks'

import type { LlmAdapter, Message } from './ai'
import type { ConversationalTrace, ConversationalTracer } from './bosun/conversationalTracer'
import { stdPrompt, type StepRegistry } from './bosun/tracer'
import type { StepTrace, StepTracer } from './bosun/stepTracer'
import type { Logger } from './interfaces'
import type { PromptFile } from './prompt-fs'

export type ChatCompletionChunk = {
    choices: Array<{
        delta?: { content?: string | null } | null
    }>
}

export interface MainStep {
    name: string
    responsePrompt: string | PromptFile
    model: LlmAdapter<ChatCompletionChunk>
}

interface ProgrammaticFilter {
    shouldStartFiltering: (state: LiveTranscript, newToken: string) => boolean
    onNewToken: (
        state: LiveTranscript,
        filteredTokens: string[],
    ) => { action: 'CONTINUE_FILTERING' } | { action: 'RELEASE_TOKENS'; tokens: string[] }
    onStreamEnd: (state: LiveTranscript, filteredTokens: string[]) => { tokensToRelease: string[] }
}

export interface ResponseChunk {
    role: 'agent' | 'system'
    delta: string
}

export interface WorkFlowConfig<CTX extends {}> {
    workflowId: string
    main: MainStep
    programmaticFilter?: ProgrammaticFilter
    afterResponseDelayMs?: number
    conversationalTracer: ConversationalTracer
    conversationalTraceMedium: ConversationalTrace['medium']
    onQuotaExceeded?: (error: Error) => Promise<void>
    onMainResponseFinished?: () => Promise<void>
    onError: (error: Error | string, ctx: CTX) => Promise<void>
}

export type AfterResponseCallback<CTX extends {}> = (
    conversation: LiveTranscript,
    ctx: CTX,
) => Promise<void>

export interface AIStreamEngine {
    createWorkflow: <CTX extends {}>(
        config: WorkFlowConfig<CTX>,
    ) => {
        run: (
            callId: string,
            messages: Message[],
            ctx: CTX,
        ) => Promise<ReadableStream<ResponseChunk>>
        afterResponse: (callback: AfterResponseCallback<CTX>) => void
    }

    loadFile: (path: string) => PromptFile
    createMainStep: (step: MainStep) => MainStep
}

export interface LiveTranscript {
    responseChunks: ResponseChunk[]
    readonly currentResponse: string
    readonly mainResponseFinished: boolean
    readonly messages: Message[]
    markMainResponseFinished(): void
    toString(ignoreDirectives?: boolean): string
    getConversation(): Message[]
}

// callId -> runId
const currentRunsStore = new Map<string, string>()

type StreamingEngineConfig = {
    logger: Logger
    stepTracer: StepTracer
    stepRegistry: StepRegistry
    basePath?: string
}

export function createStreamingEngine(cfg: StreamingEngineConfig): AIStreamEngine {
    const basePath = cfg.basePath ?? process.cwd()
    cfg.logger.debug(`Base path is: ${resolve(basePath)}`)

    const stepRegistry = cfg.stepRegistry

    function createWorkflow<CTX extends {}>({
        workflowId,
        main,
        programmaticFilter,
        afterResponseDelayMs = 2000,
        conversationalTracer,
        conversationalTraceMedium,
        onQuotaExceeded,
        onMainResponseFinished,
        onError,
    }: WorkFlowConfig<CTX>) {
        cfg.logger.debug('streamAiEngine.createWorkflow')

        stepRegistry.addStep({
            type: 'streaming-response',
            name: main.name,
            prompt: stdPrompt(main.responsePrompt),
        })

        const afterResponseCallbacks: Array<AfterResponseCallback<CTX>> = []

        async function run(callId: string, messages: Message[], ctx: CTX) {
            let streamCancelled = false
            let innerStream: ReadableStream<ResponseChunk> | null = null

            return new ReadableStream<ResponseChunk>({
                cancel: (reason) => {
                    cfg.logger.debug(`streamingWorkflow.run cancelled: ${reason}`)
                    streamCancelled = true
                    if (innerStream) {
                        innerStream.cancel(reason).catch(() => {})
                    }
                },
                start: async (controller) => {
                    try {
                        innerStream = await generateResponseStream(callId, messages, ctx)

                        for await (const chunk of innerStream) {
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

                        const err = normalizeError(e)
                        controller.error(err)

                        if (isQuotaExceededError(err) && onQuotaExceeded) {
                            await onQuotaExceeded(err)
                        }
                        await onError(err, ctx)
                    }
                },
            })
        }

        async function generateResponseStream(
            callId: string,
            messages: Message[],
            ctx: CTX,
        ): Promise<ReadableStream<ResponseChunk>> {
            const runId = crypto.randomUUID()
            cfg.logger.debug(`streamingWorkflow.run callId: ${callId}, runId: ${runId}`)
            currentRunsStore.set(callId, runId)

            const startTime = performance.now()
            const transcript = createConversation(messages, cfg.logger)

            let currentFilter: ProgrammaticFilter | null = null
            let filteredTokens: string[] = []

            const model = main.model
            const modelName = getModelName(model)
            const mainStepTrace: StepTrace = {
                workflowId,
                workflowRunId: runId,
                name: main.name,
                model: modelName,
                conversationId: callId,
                receivedContext: ctx,
                receivedPrompt: main.responsePrompt,
                createdAt: Date.now(),
                response: '',
            }

            const renderedPrompt = await renderPrompt(main.responsePrompt, ctx)
            const stringifiedConversation = transcript.toString()
            mainStepTrace.renderedPrompt = renderedPrompt
            mainStepTrace.stringifiedConversation = stringifiedConversation

            let llmStream: AsyncIterable<ChatCompletionChunk>
            try {
                llmStream = await runLLMStream({
                    systemPrompt: renderedPrompt,
                    messages: stringifiedConversation,
                    model,
                })
            } catch (err) {
                mainStepTrace.error = normalizeError(err)
                cfg.stepTracer.addStepTrace(mainStepTrace)
                await cfg.stepTracer.flush()
                throw err
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
                    if (currentRunsStore.get(callId) === runId) {
                        currentRunsStore.delete(callId)
                    }
                },
                async start(controller) {
                    try {
                        cfg.logger.debug('streamingWorkflow.run: starting main stream')

                        for await (const chunk of llmStream) {
                            if (streamCancelled) break

                            if (measureTtft) {
                                cfg.logger.debug(
                                    `[MARK] TTFT: ${(performance.now() - startTime).toFixed(2)}ms`,
                                )
                                measureTtft = false
                            }

                            const delta = chunk.choices?.[0]?.delta?.content
                            if (!delta) {
                                continue
                            }

                            mainStepTrace.response = (mainStepTrace.response || '') + delta

                            let tokensToRelease: string[] = []

                            if (currentFilter) {
                                filteredTokens.push(delta)
                                const filterResult = currentFilter.onNewToken(
                                    transcript,
                                    filteredTokens,
                                )
                                if (filterResult.action === 'RELEASE_TOKENS') {
                                    cfg.logger.debug(
                                        'streamingWorkflow.run: programmatic filter releasing tokens',
                                        { tokens: filterResult.tokens },
                                    )
                                    tokensToRelease = filterResult.tokens
                                    currentFilter = null
                                    filteredTokens = []
                                }
                            } else if (
                                programmaticFilter?.shouldStartFiltering(transcript, delta)
                            ) {
                                filteredTokens = [delta]
                                currentFilter = programmaticFilter
                                cfg.logger.debug(
                                    'streamingWorkflow.run: programmatic filter is applied on token',
                                    { delta },
                                )
                            } else {
                                tokensToRelease = [delta]
                            }

                            releaseMainStreamTokens(tokensToRelease)
                        }

                        if (streamCancelled) {
                            cfg.logger.debug(
                                `streamingWorkflow.run: stream cancelled for run ${runId}, skipping traces and afterResponse`,
                            )
                            return
                        }

                        if (currentFilter) {
                            releaseMainStreamTokens(
                                currentFilter.onStreamEnd(transcript, filteredTokens)
                                    .tokensToRelease,
                            )
                            currentFilter = null
                            filteredTokens = []
                        }

                        cfg.logger.debug('streamingWorkflow.run: markMainResponseFinished')
                        cfg.logger.debug(
                            `[MARK] finished: ${(performance.now() - startTime).toFixed(2)}ms`,
                        )
                        transcript.markMainResponseFinished()

                        cfg.stepTracer.addStepTrace(mainStepTrace)
                        await cfg.stepTracer.flush()

                        await safeAddFinishedMainStepTrace(conversationalTracer, {
                            conversationId: callId,
                            content: transcript.currentResponse,
                            medium: conversationalTraceMedium,
                        })

                        await onMainResponseFinished?.()

                        controller.close()

                        if (currentRunsStore.get(callId) !== runId) {
                            cfg.logger.debug(
                                `streamingWorkflow.run: finished main stream for run ${runId}, but a new run has started in parallel. Will not run afterResponse callbacks.`,
                            )
                            return
                        }

                        cfg.logger.debug(
                            `streamingWorkflow.run: finished main stream for run ${runId}, running afterResponse callbacks in ${afterResponseDelayMs}ms`,
                        )

                        setTimeout(() => {
                            void runAfterResponseCallbacks(callId, runId, transcript, ctx)
                        }, afterResponseDelayMs)
                    } catch (err) {
                        if (streamCancelled) {
                            cfg.logger.debug(
                                'streamingWorkflow.generateResponseStream will not propagate error due to stream cancellation',
                                err,
                            )
                            return
                        }

                        mainStepTrace.error = normalizeError(err)
                        cfg.stepTracer.addStepTrace(mainStepTrace)
                        await cfg.stepTracer.flush()

                        if (currentRunsStore.get(callId) === runId) {
                            currentRunsStore.delete(callId)
                        }

                        controller.error(normalizeError(err))
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
                },
            })
        }

        async function runAfterResponseCallbacks(
            callId: string,
            runId: string,
            transcript: LiveTranscript,
            ctx: CTX,
        ) {
            if (currentRunsStore.get(callId) !== runId) {
                cfg.logger.debug(
                    `streamingWorkflow.run ${runId} is no longer the latest run id, skipping afterResponse`,
                )
                return
            }

            try {
                cfg.logger.debug(
                    `streamingWorkflow.run running afterResponse callbacks for run ${runId}`,
                )
                for (const cb of afterResponseCallbacks) {
                    await cb(transcript, ctx)
                }
            } catch (err) {
                cfg.logger.error('Error during afterResponse processing', { err })
            } finally {
                cfg.logger.debug(
                    `streamingWorkflow.run finished afterResponse callbacks for run ${runId}, removing it from the store`,
                )
                if (currentRunsStore.get(callId) === runId) {
                    currentRunsStore.delete(callId)
                }
                cfg.stepTracer.flush().catch((err) => {
                    cfg.logger.error('Failed to flush step traces after afterResponse', { err })
                })
            }
        }

        async function runLLMStream(input: {
            systemPrompt: string
            messages: string
            model: LlmAdapter<ChatCompletionChunk>
        }): Promise<AsyncIterable<ChatCompletionChunk>> {
            cfg.logger.debug('AI Engine Stream: starting llm stream')
            return await input.model.streamResponse(input.systemPrompt, input.messages)
        }

        async function renderPrompt(prompt: string | PromptFile, context: CTX) {
            const template = typeof prompt === 'string' ? prompt : await prompt.content()

            nunjucks.configure({
                autoescape: true,
                trimBlocks: true,
                lstripBlocks: true,
            })
            return nunjucks.renderString(template, context)
        }

        async function safeAddFinishedMainStepTrace(
            tracer: ConversationalTracer,
            input: {
                conversationId: string
                content: string
                medium: ConversationalTrace['medium']
            },
        ) {
            try {
                tracer.addConversationalTrace({
                    conversationId: input.conversationId,
                    eventName: 'finished-main-streaming-step',
                    role: 'agent',
                    medium: input.medium,
                    content: input.content,
                    createdAt: Date.now(),
                })
                await tracer.flush()
            } catch (err) {
                cfg.logger.error('Failed to write conversational trace', { err })
            }
        }

        function isQuotaExceededError(err: unknown): err is Error {
            if (!(err instanceof Error)) return false
            if (err.name === 'RateLimitError') return true
            if (hasStatus(err) && err.status === 429) return true
            return err.constructor?.name === 'RateLimitError'
        }

        function hasStatus(value: Error): value is Error & { status: unknown } {
            return 'status' in value
        }

        function getModelName(model: LlmAdapter): string {
            const options = model.getOptions()
            if (!options || typeof options !== 'object') return 'unknown'

            const maybeModel = (options as Record<string, unknown>).model
            return typeof maybeModel === 'string' ? maybeModel : 'unknown'
        }

        return {
            run,
            afterResponse: (cb: AfterResponseCallback<CTX>) => {
                afterResponseCallbacks.push(cb)
            },
        }
    }

    function loadFile(path: string): PromptFile {
        return {
            type: 'file',
            path,
            content: async () => {
                cfg.logger.debug('loading prompt:', path)
                return fs.promises.readFile(join(basePath, path), 'utf-8')
            },
        }
    }

    return {
        createWorkflow,
        loadFile,
        createMainStep,
    }
}

function normalizeError(err: unknown): Error {
    if (err instanceof Error) return err
    if (typeof err === 'string') return new Error(err)

    try {
        return new Error(JSON.stringify(err))
    } catch {
        return new Error(String(err))
    }
}

function createConversation(initialMessages: Message[], logger: Logger): LiveTranscript {
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
                .map((token) => token.delta)
                .join('')
        },

        get mainResponseFinished() {
            return finished
        },

        get messages() {
            return messages
        },

        markMainResponseFinished() {
            logger.debug('AIEngine.Conversation, markMainResponseFinished')
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

function createMainStep(step: MainStep): MainStep {
    return step
}
