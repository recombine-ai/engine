// cspell:words TTFT lstrip
import nunjucks from 'nunjucks'

import { createStubStepTracer, StepTrace } from '../bosun'
import { PromptFile } from '../prompt-fs'
import {
    Logger,
    Message,
    AIStreamEngine,
    ResponseChunk,
    StreamingEngineConfig,
    Transcript,
    StreamWorkflowConfig,
} from '../interfaces'
import { stdPrompt } from '../step-registry'
import { agentFilter, composeTokenTransformers } from './token-transformers'

export function createAIStreamEngine<CTX extends {}>(
    cfg: StreamingEngineConfig,
): AIStreamEngine<CTX> {
    function createWorkflow<CTX>({
        name,
        prompt,
        model,
        tokenTransformers = [agentFilter],
        onError,
    }: StreamWorkflowConfig<CTX>) {
        const logger = cfg.logger || console
        logger.debug('streamAiEngine.createWorkflow')
        const stepTracer = cfg.stepTracer || createStubStepTracer(logger)
        cfg.stepRegistry?.addStep({
            type: 'streaming-response',
            name,
            prompt: stdPrompt(prompt),
        })

        async function run(messages: Message[], ctx: CTX) {
            const runId = crypto.randomUUID()
            logger.debug(`streamingWorkflow.run runId: ${runId}`)
            const startTime = performance.now()
            const transcript = createTranscript(logger, messages)
            const initiatedTransformers = tokenTransformers.map((init) => init())

            // Create step trace for telescope
            const mainStepTrace: StepTrace = {
                workflowId: name,
                workflowRunId: runId,
                name: name,
                model: JSON.stringify(model.getOptions()),
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
                logger.error('AI Engine Stream: LLM error', { error })
                mainStepTrace.error = error instanceof Error ? error : new Error(String(error))
                stepTracer.addStepTrace(mainStepTrace)
                await stepTracer.flush()
                await onError(error as Error | string, ctx)
                return new ReadableStream<ResponseChunk>({
                    start(controller) {
                        controller.error(error)
                    },
                })
            }

            return mainStepStream
                .pipeThrough(metrics(startTime))
                .pipeThrough(composeTokenTransformers(initiatedTransformers))
                .pipeThrough(packageAsResponseChunk())
                .pipeThrough(pushToTranscript(transcript))
                .pipeThrough(flushTrace(mainStepTrace, transcript))
        }

        function metrics<T>(startTime: number) {
            let measureTtft = true
            return new TransformStream<T, T>({
                start() {
                    logger.debug(
                        `[MARK] LLM stream created: ${(performance.now() - startTime).toFixed(2)}ms`,
                    )
                },

                transform(chunk, controller) {
                    if (measureTtft) {
                        logger.debug(`[MARK] TTFT: ${(performance.now() - startTime).toFixed(2)}ms`)
                        measureTtft = false
                    }
                    controller.enqueue(chunk)
                },

                flush() {
                    logger.debug(
                        `[MARK] LLM stream finished: ${(performance.now() - startTime).toFixed(2)}`,
                    )
                },
            })
        }

        function packageAsResponseChunk() {
            return new TransformStream<string, ResponseChunk>({
                transform(chunk, controller) {
                    controller.enqueue({ role: 'agent', delta: chunk })
                },
            })
        }

        function pushToTranscript(transcript: Transcript) {
            return new TransformStream<ResponseChunk, ResponseChunk>({
                transform(chunk, controller) {
                    transcript.responseChunks.push(chunk)
                    controller.enqueue(chunk)
                },
            })
        }

        function flushTrace<T>(mainStepTrace: StepTrace, transcript: Transcript) {
            return new TransformStream<T, T>({
                async flush() {
                    // Add step trace and flush to telescope
                    mainStepTrace.response = transcript.currentResponse
                    stepTracer.addStepTrace(mainStepTrace)
                    try {
                        await stepTracer.flush()
                    } catch (e) {
                        logger.error('stepTracer.flush failed', { error: e })
                    }
                },
            })
        }

        async function renderPrompt(prompt: string | PromptFile, context?: CTX) {
            logger.debug('Streaming AI, CONTEXT:', context)
            const template = typeof prompt === 'string' ? prompt : await prompt.content()
            if (context) {
                logger.debug('Loaded context: ', context)
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

        get messages() {
            return initialMessages
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
