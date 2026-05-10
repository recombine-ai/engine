// cspell:words lstripBlocks
import { randomUUID } from 'crypto'
import nunjucks from 'nunjucks'
import * as Zod from 'zod'
import { Logger } from './interfaces'
import { PromptFile } from './prompt-fs'
import { createStubStepTracer, StepTrace, StepTracer } from './bosun/step-tracer'
import { createStubRegistry, stdPrompt, StepRegistry } from './bosun/step-registry'

export interface LlmAdapter {
    /**
     * @param systemPrompt - rendered system prompt
     * @param messages - stringified {@link Conversation}
     * @param schema - optional Zod schema to pass to the model. Will overwrite any schema set in adapter options.
     * @returns LLM Response
     */
    generateResponse: (
        systemPrompt: string,
        messages: string,
        schema?: Zod.ZodType,
    ) => Promise<string>
    /** Returns adapter's configuration/options for tracing */
    getOptions: () => unknown
}

export interface BasicStep<CTX> {
    /** Step name  */
    name: string

    /** Determines if the step should be run or not */
    runIf?: (messages: Conversation, ctx: CTX) => boolean | Promise<boolean>

    /**
     * When provided, throws an error if the step is invoked more times than `maxAttempts`.
     * Number of attempts taken is reset when the flow passed the step that was rewinding.
     */
    maxAttempts?: number

    /** Error handler called if an error occurred during in `execute` function */
    onError?: (error: string, ctx: CTX) => Promise<unknown>
}

export interface ProgrammaticStep<CTX> extends BasicStep<CTX> {
    /** Content of the step */
    execute: (messages: Conversation, ctx: CTX, workflow: WorkflowControls) => Promise<unknown>
}

export interface LLMStep<CTX> extends BasicStep<CTX> {
    /** LLM adapter to use */
    model: LlmAdapter

    /**
     * Prompt can be a simple string or a link to a file, loaded with `loadFile` function which
     * takes a path to the file relative to `src/use-cases` directory. Should be Nunjucks-compatible.
     */
    prompt: string | PromptFile

    /**
     * Do not put messages that were added via {@link Conversation.addMessage} into the prompt.
     */
    ignoreAddedMessages?: boolean
}

export interface WorkflowControls {
    /**
     * Terminates the workflow, preventing further steps from being executed.
     */
    terminate: () => void

    /**
     * Rewinds the workflow execution to a specific step.
     * @param step - The name of the step to rewind to
     */
    rewindTo: (step: string) => void
}

export interface JsonLLMStep<CTX, Schema extends Zod.ZodType> extends LLMStep<CTX> {
    /**
     * Defines the expected structure of the LLM's output. Accepts ZodSchema. When provided, the
     * LLM's response is validated and parsed according to this schema ensuring reliable structured
     * output.
     */
    schema: Schema
    /**
     * Function to execute with the LLM's response. Use {@link setProposedReply} to use the LLM's output as the proposed reply.
     * Or use combination of {@link getProposedReply} and {@link setProposedReply} to substitute parts of the string.
     * @example
     * ```
     * // Use LLM output directly as reply
     * execute: (reply) => messages.setProposedReply(reply)
     *
     * // Substitute tokens in LLM output
     * execute: (reply) => {
     *   const withLink = reply.replace('<PAYMENT_LINK>', 'https://payment.example.com/123')
     *   messages.setProposedReply(withLink)
     * }
     * ```
     */
    execute: (
        reply: Zod.infer<Schema>,
        conversation: Conversation,
        ctx: CTX,
        workflowControls: WorkflowControls,
    ) => Promise<unknown>
}

export interface StringLLMStep<CTX> extends LLMStep<CTX> {
    /**
     * Function to execute with the LLM's response. Use {@link setProposedReply} to use the LLM's output as the proposed reply.
     * Or use combination of {@link getProposedReply} and {@link setProposedReply} to substitute parts of the string.
     * @example
     * ```
     * // Use LLM output directly as reply
     * execute: (reply) => messages.setProposedReply(reply)
     *
     * // Substitute tokens in LLM output
     * execute: (reply) => {
     *   const withLink = reply.replace('<PAYMENT_LINK>', 'https://payment.example.com/123')
     *   messages.setProposedReply(withLink)
     * }
     * ```
     */
    execute: (
        reply: string,
        conversation: Conversation,
        ctx: CTX,
        workflowControls?: WorkflowControls,
    ) => Promise<unknown>
}

type BeforeEachStep<CTX> = (
    conversation: Conversation,
    ctx: CTX,
    workflowControls?: WorkflowControls,
) => Promise<void>

/**
 * An AI workflow composed of steps.
 */
export interface Workflow<CTX> {
    /**
     * Runs the workflow with a given conversation context.
     * Executes steps sequentially until completion or termination.
     * @param conversation - The conversation context for the workflow
     * @param contextProvider - A provider function for the context that will be passed to all steps and to all prompts in those steps
     * @param beforeEach - A callback, that runs before each step
     * @returns The proposed reply if workflow completes, or null if terminated
     */
    run: (
        conversation: Conversation,
        contextProvider: (() => CTX) | (() => Promise<CTX>),
        beforeEach?: BeforeEachStep<CTX>,
    ) => Promise<string | null>
}

type WorkflowStep<CTX> = StringLLMStep<CTX> | JsonLLMStep<CTX, any> | ProgrammaticStep<CTX>

/**
 * Config object to be used in {@link AIEngine#createWorkflow}
 */
export interface WorkflowConfig<CTX> {
    /** workflow name, to use in traces, defaults to 'workflow' */
    name?: string
    /** a function that will run once, if any of the steps going to be executed */
    beforeExecute?: (ctx: CTX) => Promise<void>
    /** a function that will run once, if any of the steps was executed */
    afterExecute?: (ctx: CTX) => Promise<void>
    /** common error handler for workflow */
    onError: (error: string, ctx: CTX) => Promise<unknown>
    /** workflow steps {@link ProgrammaticStep}, {@link StringLLMStep} or {@link JsonLLMStep} */
    steps?: WorkflowStep<CTX>[]
}

interface StepBuilder<CTX> {
    <Schema extends Zod.ZodType>(step: JsonLLMStep<CTX, Schema>): JsonLLMStep<CTX, Schema>
    (step: StringLLMStep<CTX>): StringLLMStep<CTX>
    (step: ProgrammaticStep<CTX>): ProgrammaticStep<CTX>
}

/**
 * The main interface for the AI Engine.
 *
 * @example
 * ```typescript
 * import { createAIEngine } from '@recombine-ai/engine'
 *
 * Create a new AI engine instance
 * const ai = createAIEngine({
 *   // engine configuration, see EngineConfig
 * })
 *
 * // create a conversation to be used in workflow.run(), see Conversation
 * const conversation = ai.createConversation(messages)
 * // create a workflow, see WorkflowConfig
 * const workflow = ai.createWorkflow({steps})
 * workflow.run(conversation)
 * ```
 */
export interface AIEngine {
    /**
     * Creates a workflow from a sequence of steps.
     * @param config - common parameters for a workflow
     * @returns AI workflow Workflow.
     */
    createWorkflow: <CTX extends object>(config: WorkflowConfig<CTX>) => Workflow<CTX>

    /**
     * Creates a new conversation instance.
     * @param messages - Optional initial messages for the conversation.
     * @returns A new Conversation object.
     */
    createConversation: (messages?: Message[]) => Conversation

    /**
     * Get the function to create steps to use with {@link WorkflowConfig#steps}
     * if you want to define steps outside of workflow.
     */
    getStepBuilder<CTX>(): StepBuilder<CTX>

    /**
     * Renders a prompt string using Nunjucks templating engine.
     * @param prompt - The prompt string to render.
     * @param context - Optional context object to use for rendering the prompt.
     * @returns The rendered prompt string.
     */
    renderPrompt: (prompt: string, context?: object) => string
}

/**
 * Represents a conversation between a user and an AI agent.
 * Provides methods to manage the conversation flow, format messages, and convert the conversation
 * to a string representation.
 */
export interface Conversation {
    /**
     * Sets the default formatter to stringify messages when toString is called.
     * @param formatter - A function that takes a message and returns a formatted string.
     */
    setDefaultFormatter: (formatter: (message: Message) => string) => void

    /**
     * Converts the conversation to a string representation to be fed to an LLM.
     * @param filter - A function that filters messages based on certain criteria.
     * @example
     * @returns The string representation of the conversation.
     */
    toString: (options?: { ignoreAddedMessages?: boolean }) => string

    /**
     * Adds a message from a specified sender to the conversation.
     * @param message - The message to add to the conversation.
     */
    addMessage: (message: Message, opts?: { formatter?: (message: Message) => string }) => void

    /**
     * Sets a custom formatter for proposed messages.
     * @param formatter - A function that takes a message string and returns a formatted string.
     */
    setProposedMessageFormatter: (formatter: (message: string) => string) => void

    /**
     * Sets a proposed reply message.
     * @param message - The proposed reply message.
     */
    setProposedReply: (message: string) => void

    /**
     * Gets the current proposed reply message.
     * @returns The proposed reply message, or null if none exists.
     */
    getProposedReply: () => string | null

    /**
     * Gets the history of all messages in the conversation. Returns {@link Message} rather than
     * {@link ConversationMessage} because none of the {@link ConversationMessage} properties should
     * be accessed outside of the {@link Conversation} context.
     * @returns An array of Message objects representing the conversation history.
     */
    getHistory: () => Message[]
}

/**
 * Represents a message in a conversation between a user and an agent, or a system message.
 * Messages can contain text and optionally an image URL. To be used in the {@link Conversation} interface.
 */
export interface Message {
    /** The sender of the message, which can be one of the following: 'user', 'agent', or 'system' */
    sender: 'user' | 'agent' | 'system'
    /** The text content of the message */
    text: string
    /** Optional URL of an image associated with the message */
    imageUrl?: string
}

/**
 * Configuration options for the Engine.
 */
export interface EngineConfig {
    /**  Optional logger instance for handling log messages.  */
    logger?: Logger
    /** traces received prompt, rendered prompt, context and other useful info about LLM execution */
    stepTracer?: StepTracer

    /** registers steps in workflow to be available in Bosun IDE */
    stepRegistry?: StepRegistry

    /** Optional nunjucks Environment to customize prompt rendering.  */
    nunjucksEnv?: nunjucks.Environment
}

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
export function createAIEngine(cfg: EngineConfig = {}): AIEngine {
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
                    const stringResponse = await runLLM(
                        step.model,
                        prompt,
                        stringifiedMessages,
                        step.schema,
                    )
                    stepTrace.response = stringResponse

                    let parsedJsonResponse: unknown = undefined
                    try {
                        parsedJsonResponse = JSON.parse(stringResponse)
                        response = step.schema.parse(parsedJsonResponse)
                    } catch (err) {
                        if (err instanceof SyntaxError) {
                            logger.error(
                                `AI-generated response is not valid JSON in step ${step.name}`,
                                {
                                    response: stringResponse,
                                    schema: Zod.toJSONSchema(step.schema),
                                },
                            )
                            throw new Error(`Response is not valid JSON for step ${step.name}`)
                        } else {
                            logger.error(
                                `AI-generated response in step ${step.name} violates schema`,
                                {
                                    response: stringResponse,
                                    schema: Zod.toJSONSchema(step.schema),
                                    errors: step.schema.safeParse(parsedJsonResponse).error,
                                },
                            )
                            throw new Error(`Response validation failed for step ${step.name}`)
                        }
                    }
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

    constructor(
        private logger: Logger,
        private steps: WorkflowStep<CTX>[],
    ) {
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
