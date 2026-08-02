// cspell:words lstripBlocks
import { randomUUID } from 'crypto'
import nunjucks from 'nunjucks'
import * as Zod from 'zod'
import {
    BeforeEachStep,
    Conversation,
    JsonLLMStep,
    Logger,
    Message,
    ProgrammaticStep,
    StepBuilder,
    StringLLMStep,
    Workflow,
    WorkflowConfig,
    WorkflowStep,
} from './interfaces'
import { createStubStepTracer, StepTrace } from './bosun/step-tracer'
import { createStubRegistry, stdPrompt } from './step-registry'
import { AIEngine, EngineConfig } from './interfaces/engine'
import { LlmAdapter } from './interfaces/adapter'
import { reportProviderError } from './monitoring'

const STRUCTURED_RESPONSE_MAX_ATTEMPTS = 3

/**
 * Creates an AI Engine with the given configuration.
 *
 * The AI Engine provides utilities for creating and running conversational workflows
 * with large language models, specifically OpenAI GPT models.
 *
 * @returns An AIEngine instance.
 *
 * @example
 * ```ts
 * const engine = createAIEngine({
 *   logger: customLogger,
 * });
 *
 * const workflow = await engine.createWorkflow(
 *   engine.createStep({
 *     name: 'generate-response',
 *     prompt: engine.loadFile('prompts/response.txt'),
 *     execute: (response) => conversation.setProposedReply(response)
 *   })
 * );
 *
 * const reply = await workflow.run(conversation);
 * ```
 */
export function createAIEngine<CTX extends object>(cfg: EngineConfig = {}): AIEngine<CTX> {
    const logger = cfg.logger || globalThis.console
    const stepTracer = cfg.stepTracer || createStubStepTracer(logger)
    const registry = cfg.stepRegistry || createStubRegistry(logger)

    function createWorkflow<CTX extends object>({
        onError,
        beforeExecute,
        afterExecute,
        steps = [],
        name = 'workflow',
    }: WorkflowConfig<CTX>): Workflow<CTX> {
        steps.forEach(addStepToTracer)
        return {
            run: async (
                messages: Conversation,
                contextProvider: (() => CTX) | (() => Promise<CTX>),
                beforeEach?: BeforeEachStep<CTX>,
            ) => {
                const state = new WorkflowState<CTX>(logger, steps)
                let beforeHookExecuted = false
                let didExecute = false
                do {
                    const ctx = await contextProvider()
                    await beforeEach?.(messages, ctx, state)
                    const step = state.getStep()
                    if (state.isTerminated()) {
                        logger.log('AI Engine, run terminated')
                        break
                    }
                    if (!step.runIf || (await step.runIf(messages, ctx))) {
                        // TODO: drop actions, they are replaced by traces

                        didExecute = true
                        if (beforeExecute && !beforeHookExecuted) {
                            await beforeExecute(ctx)
                            beforeHookExecuted = true
                        }
                        if ('prompt' in step) {
                            await runStep(step, messages, ctx, state)
                        } else {
                            await runProgrammaticStep(step, messages, ctx, state)
                        }
                    }
                } while (state.next())

                if (afterExecute && didExecute) {
                    await afterExecute(await contextProvider())
                }

                await stepTracer.flush()
                return state.isTerminated() ? null : messages.getProposedReply()
            },
        }

        function addStepToTracer(step: WorkflowStep<CTX>) {
            if ('prompt' in step) {
                registry.addStep({
                    name: step.name,
                    prompt: stdPrompt(step.prompt),
                    type: 'text',
                    schema: 'schema' in step ? step.schema : undefined,
                })
            }
        }

        async function runStep(
            step: StringLLMStep<CTX> | JsonLLMStep<CTX, any>,
            conversation: Conversation,
            ctx: CTX,
            state: WorkflowState<CTX>,
        ): Promise<void> {
            const stepTrace: StepTrace = {
                name: step.name,
                workflowId: name,
                workflowRunId: state.runId,
                createdAt: Date.now(),
                model: JSON.stringify(step.model.getOptions()),
                schema:
                    'schema' in step
                        ? step.schema instanceof Zod.ZodType
                            ? step.schema
                            : undefined
                        : undefined,
            }

            try {
                stepTrace.receivedContext = ctx
                let response: string | null = null
                let prompt =
                    typeof step.prompt === 'string' ? step.prompt : await step.prompt.content()
                stepTrace.receivedPrompt = prompt
                prompt = renderPrompt(prompt, ctx)

                stepTrace.renderedPrompt = prompt
                const stringifiedMessages = conversation.toString({
                    ignoreAddedMessages: step.ignoreAddedMessages,
                })
                stepTrace.stringifiedConversation = stringifiedMessages

                if ('schema' in step) {
                    const { parsedResponse, rawResponse } = await runStructuredStepWithRetries(
                        step.model,
                        prompt,
                        stringifiedMessages,
                        step.name,
                        step.schema,
                    )
                    response = parsedResponse as any
                    stepTrace.response = rawResponse
                } else {
                    response = await runLLM(step.model, prompt, stringifiedMessages, undefined)
                    stepTrace.response = response
                }
                if (!response) {
                    throw new Error('No response from OpenAI')
                }
                logger.log(`AI Engine, executing ${step.name}`)
                await step.execute(response, conversation, ctx, state)
            } catch (err) {
                // Before `err` is normalised into an `Error`, which would drop the SDK's status and
                // headers. Non-provider failures are ignored by the classifier.
                reportProviderError(err, {
                    logger,
                    eventTracer: cfg.eventTracer,
                    providerInfo: step.model.getProviderInfo?.(),
                })
                const error = err instanceof Error ? err : new Error(String(err))
                stepTrace.error = error
                try {
                    await (step.onError
                        ? step.onError(error.message, ctx)
                        : onError(error.message, ctx))
                } catch (onErrorErr) {
                    logger.error('AI Engine, onError handler failed', {
                        err: onErrorErr,
                        stepName: step.name,
                    })

                    if (onErrorErr instanceof Error) {
                        throw onErrorErr
                    } else if (typeof onErrorErr === 'string') {
                        throw new Error(onErrorErr)
                    } else {
                        throw new Error('Unknown error in onError handler')
                    }
                }
                state.terminate()
            } finally {
                stepTracer.addStepTrace(stepTrace)
            }
        }

        async function runProgrammaticStep(
            step: ProgrammaticStep<CTX>,
            messages: Conversation,
            ctx: CTX,
            state: WorkflowState<CTX>,
        ) {
            try {
                if (!step.runIf || (await step.runIf(messages, ctx))) {
                    await step.execute(messages, ctx, state)
                }
            } catch (error) {
                logger.error(
                    `AI Engine, error in dumb step ${step.name}: ${(error as Error).message}`,
                )
                await (step.onError
                    ? step.onError((error as Error).message, ctx)
                    : onError((error as Error).message, ctx))
                state.terminate()
            }
        }
    }

    async function runLLM(
        model: LlmAdapter,
        systemPrompt: string,
        messages: string,
        schema?: Zod.ZodType,
    ) {
        return model.generateResponse(systemPrompt, messages, schema)
    }

    function renderPrompt(prompt: string, context?: object): string {
        if (cfg.nunjucksEnv) {
            return cfg.nunjucksEnv.renderString(prompt, context ?? {})
        }

        nunjucks.configure({
            autoescape: false,
            trimBlocks: true,
            lstripBlocks: true,
        })
        return nunjucks.renderString(prompt, context ?? {})
    }

    async function runStructuredStepWithRetries(
        model: LlmAdapter,
        prompt: string,
        stringifiedMessages: string,
        stepName: string,
        schema: Zod.ZodType,
    ): Promise<{ parsedResponse: unknown; rawResponse: string }> {
        for (let attempt = 1; attempt <= STRUCTURED_RESPONSE_MAX_ATTEMPTS; attempt++) {
            const stringResponse = await runLLM(model, prompt, stringifiedMessages, schema)

            let parsedJsonResponse: unknown = undefined
            try {
                parsedJsonResponse = JSON.parse(stringResponse)
            } catch {
                const hasAttemptsLeft = attempt < STRUCTURED_RESPONSE_MAX_ATTEMPTS
                if (hasAttemptsLeft) {
                    logger.debug(
                        `AI-generated response is not valid JSON in step ${stepName}, retry ${attempt}/${STRUCTURED_RESPONSE_MAX_ATTEMPTS}`,
                    )
                    continue
                }

                logger.error(`AI-generated response is not valid JSON in step ${stepName}`, {
                    response: stringResponse,
                    schema: Zod.toJSONSchema(schema),
                })
                throw new Error(`Response is not valid JSON for step ${stepName}`)
            }

            const parsedResponse = schema.safeParse(parsedJsonResponse)
            if (parsedResponse.success) {
                return {
                    parsedResponse: parsedResponse.data,
                    rawResponse: stringResponse,
                }
            }

            const hasAttemptsLeft = attempt < STRUCTURED_RESPONSE_MAX_ATTEMPTS
            if (hasAttemptsLeft) {
                logger.debug(
                    `AI-generated response in step ${stepName} violates schema, retry ${attempt}/${STRUCTURED_RESPONSE_MAX_ATTEMPTS}`,
                    {
                        response: stringResponse,
                        errors: parsedResponse.error,
                    },
                )
                continue
            }

            logger.error(`AI-generated response in step ${stepName} violates schema`, {
                response: stringResponse,
                schema: Zod.toJSONSchema(schema),
                errors: parsedResponse.error,
            })
            throw new Error(`Response validation failed for step ${stepName}`)
        }

        throw new Error(`Response validation failed for step ${stepName}`)
    }

    return {
        createWorkflow,
        createConversation,
        renderPrompt,
        getStepBuilder() {
            return (step: any) => step
        },
    }
}

class WorkflowState<CTX> {
    private shouldRun = true
    private currentStep = 0
    /** map, step index to number of attempts */
    private attempts = new Map<number, number>()
    private rewinder = 0
    private lastRewindTo = 0
    readonly runId: string

    constructor(private logger: Logger, private steps: WorkflowStep<CTX>[]) {
        this.runId = randomUUID()
    }

    terminate() {
        this.logger.debug('AI Engine: Terminating conversation...')
        this.shouldRun = false
    }
    isTerminated() {
        return !this.shouldRun
    }
    getStep() {
        return this.steps[this.currentStep] || null
    }
    next() {
        this.currentStep++
        if (this.rewinder < this.currentStep) {
            this.attempts.delete(this.lastRewindTo)
        }
        return this.currentStep < this.steps.length
    }
    rewindTo(stepName: string) {
        this.rewinder = this.currentStep
        const index = this.steps.findIndex((s) => s.name === stepName)
        if (index < 0) {
            const names = this.steps.map((s) => s.name).join(', ')
            throw new Error(`Tried to rewind to ${stepName}, steps: [${names}]`)
        }
        this.currentStep = index - 1 // -1 because .next() will be called right after
        this.lastRewindTo = this.currentStep

        const step = this.steps[index]
        const max = step.maxAttempts || 10
        const attempt = this.attempts.get(this.currentStep) ?? 1
        if (attempt >= max) {
            throw new Error(`Max attempts reached for step ${step.name}`)
        }
        this.attempts.set(this.currentStep, attempt + 1)
    }
}

export function createConversation(initialMessages: Message[] = []): Conversation {
    const messages = initialMessages.map((msg) => ({
        ...msg,
        isAddedMessage: false,
        formatter: undefined as ((message: Message) => string) | undefined,
    }))
    const names: Record<Message['sender'], string> = {
        agent: 'Agent',
        user: 'User',
        system: 'System',
    }
    let defaultFormatter = (message: Message) => `${names[message.sender]}: ${message.text}`
    let proposedFormatter = (message: string) => `Proposed reply: ${message}`
    let proposedReply: string | null = null
    return {
        toString: (options?: { ignoreAddedMessages?: boolean }) => {
            return (
                messages
                    .filter((msg) => !options?.ignoreAddedMessages || !msg.isAddedMessage)
                    .map((msg) => {
                        return msg.formatter ? msg.formatter(msg) : defaultFormatter(msg)
                    })
                    .filter((msg) => msg !== null)
                    .join('\n') + (proposedReply ? `\n${proposedFormatter(proposedReply)}` : '')
            )
        },
        addMessage: (message: Message, opts?: { formatter?: (message: Message) => string }) => {
            messages.push({
                ...message,
                isAddedMessage: true,
                formatter: opts?.formatter ?? defaultFormatter,
            })
        },
        setDefaultFormatter: (formatter: (message: Message) => string) => {
            defaultFormatter = formatter
        },
        setProposedMessageFormatter: (formatter: (msg: string) => string) => {
            proposedFormatter = formatter
        },
        setProposedReply: (message: string) => (proposedReply = message),
        getProposedReply: () => proposedReply,
        getHistory: () => messages,
    }
}

export function getStepBuilder<CTX = unknown>(): StepBuilder<CTX> {
    return (step: any) => step
}
