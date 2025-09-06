// cspell:words lstripBlocks
import OpenAI from 'openai'
import { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions'
import nunjucks from 'nunjucks'
import { ZodSchema } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { Logger } from './interfaces'
import { makeAction, SendAction } from './bosun/action'
import { sleep } from 'openai/core'
import { PromptFile } from './prompt-fs'
import { StepTrace, StepTracer } from './bosun/stepTracer'
import { Tracer } from './bosun'
import { createConsoleTracer, stdPrompt } from './bosun/tracer'

/**
 * Represents a basic model name for LLMs.
 */
export type BasicModel =
    | 'o3-mini-2025-01-31'
    | 'o1-preview-2024-09-12'
    | 'gpt-4o-2024-11-20'
    | 'o1-2024-12-17'
    | (string & {}) // prevents compiler from simplifying the type to just `string`

export interface ProgrammaticStep<CTX> {
    /** Step name for debugging */
    name: string

    /** Determines if the step should be run or not */
    runIf?: (messages: Conversation, ctx: CTX) => boolean | Promise<boolean>

    /** Content of the step */
    execute: (messages: Conversation, ctx: CTX) => Promise<unknown>

    /** Error handler called if an error occurred during in `execute` function */
    onError?: (error: string, ctx: CTX) => Promise<unknown>
}

export interface LLMStep<CTX> {
    /** Step name for debugging */
    name: string

    /** Determines if the step should be run or not */
    runIf?: (messages: Conversation, ctx: CTX) => boolean | Promise<boolean>

    /** LLM to use. Defaults to gpt-4o */
    model?: BasicModel

    /**
     * Prompt can be a simple string or a link to a file, loaded with `loadFile` function which
     * takes a path to the file relative to `src/use-cases` directory. Should be Nunjucks-compatible.
     */
    prompt: string | PromptFile

    /**
     * Do not put messages that were added via {@link Conversation.addMessage} into the prompt.
     */
    ignoreAddedMessages?: boolean

    /**
     * When provided, throws an error if the step is invoked more times than `maxAttempts`.
     * Number of attempts taken is reset when `shouldExecute` returns `false`. Useful to limit
     * rewinds by reviewers. NOTE that it doesn't work on steps without `shouldExecute` method.
     */
    maxAttempts?: number

    /** Error handler called if an error occurred during LLM API call or in `execute` function */
    onError?: (error: string, ctx: CTX) => Promise<unknown>
}

export interface JsonLLMStep<CTX, SCHEMA> extends LLMStep<CTX> {
    /**
     * Defines the expected structure of the LLM's output. Accepts ZodSchema. When provided, the
     * LLM's response is validated and parsed according to this schema ensuring reliable structured
     * output.
     */
    schema: ZodSchema<SCHEMA>
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
    execute: (reply: SCHEMA, conversation: Conversation, ctx: CTX) => Promise<unknown>

    /**
     * Check a condition, whether the `execute` function should run or not
     * @deprecated use `runIf` to check if the step should be run, use if in `execute` to check
     * if it should be executed
     **/
    shouldExecute?: (reply: SCHEMA, ctx: CTX) => boolean | Promise<boolean>
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
    execute: (reply: string, conversation: Conversation, ctx: CTX) => Promise<unknown>

    /**
     * Check a condition, whether the `execute` function should run or not
     * @deprecated use `runIf` to check if the step should be run, use if in `execute` to check
     * if it should be executed
     **/
    shouldExecute?: (reply: string, ctx: CTX) => boolean | Promise<boolean>
}

/**
 * An AI workflow composed of steps.
 */
export interface Workflow<CTX> {
    /**
     * Terminates the workflow, preventing further steps from being executed.
     */
    terminate: () => void

    /**
     * Runs the workflow with a given conversation context.
     * Executes steps sequentially until completion or termination.
     * @param messages - The conversation context for the workflow
     * @returns The proposed reply if workflow completes, or null if terminated
     */
    run: (
        messages: Conversation,
        ctx?: CTX,
    ) => Promise<string | null>

    /**
     * Rewinds the workflow execution to a specific step.
     * @param step - The step to rewind to
     */
    rewindTo: (step: LLMStep<CTX> | ProgrammaticStep<CTX>) => void

    /**
     * Registers a callback to be executed before each step.
     * @param callback - Async function to execute before each step
     */
    beforeEach: (callback: () => Promise<unknown>) => void

    addStep<SCHEMA>(step: JsonLLMStep<CTX, SCHEMA>): void
    addStep(step: StringLLMStep<CTX>): void
    addStep(step: ProgrammaticStep<CTX>): void
}

export interface WorkflowConfig<CTX> {
    onError: (error: string, ctx: CTX) => Promise<unknown>
}

/**
 * The main interface for the AI Engine.
 *
 * @example
 * ```typescript
 * import { AIEngine } from './lib/ai'
 *
 * // Create a new AI engine instance
 * const ai = AIEngine.createAIEngine()
 *
 * // Create a conversation
 * const conversation = ai.createConversation()
 * conversation.addMessage('user', 'I need help with my order')
 *
 * // Define workflow steps
 * const killswitch = ai.createStep({
 *   name: 'killswitch',
 *   prompt: ai.loadFile('prompts/killswitch.njk'),
 *   execute: async (reply) => {
 *     const result = JSON.parse(reply)
 *     if (result.terminate) {
 *       conversation.addDirective(`Terminating workflow: ${result.reason}`)
 *       return workflow.terminate()
 *     }
 *   },
 *   onError: async (error) => conversation.addDirective(`Error in killswitch: ${error}`)
 * })
 *
 * const analyzeIntent = ai.createStep({
 *   name: 'analyze-intent',
 *   prompt: ai.loadFile('prompts/analyze-intent.njk'),
 *   execute: async (reply) => {
 *     const intent = JSON.parse(reply)
 *     conversation.addDirective(`User intent is: ${intent.category}`)
 *   },
 *   onError: async (error) => conversation.addDirective(`Error analyzing intent: ${error}`)
 * })
 *
 * const mainReply = ai.createStep({
 *   name: 'main-reply',
 *   prompt: ai.loadFile('prompts/generate-response.njk'),
 *   execute: async (reply) => conversation.setProposedReply(reply),
 *   onError: async (error) => conversation.setProposedReply(`I'm sorry, I'm having trouble right now.`)
 * })
 *
 * // Create and run the workflow
 * const workflow = await ai.createWorkflow(killswitch, analyzeIntent, mainReply)
 * const response = await workflow.run(conversation)
 * console.log(response)
 * ```
 */
export interface AIEngine {
    /**
     * Creates a workflow from a sequence of steps.
     * @param config - common parameters for a workflow
     * @returns A Promise that resolves to the created Workflow.
     */
    createWorkflow: <CTX>(config: WorkflowConfig<CTX>) => Workflow<CTX>

    /**
     * Creates a new conversation instance.
     * @param messages - Optional initial messages for the conversation.
     * @returns A new Conversation object.
     */
    createConversation: (messages?: Message[]) => Conversation

    /**
     * Renders a prompt string using Nunjucks templating engine.
     * @param prompt - The prompt string to render.
     * @param context - Optional context object to use for rendering the prompt.
     * @returns The rendered prompt string.
     */
    renderPrompt: typeof renderPrompt
}

/**
 * Represents a conversation between a user and an AI agent.
 * Provides methods to manage the conversation flow, format messages, and convert the conversation to a string representation.
 *
 * @example
 * ```typescript
 * // Create a new conversation instance
 * const conversation = new Conversation();
 *
 * // Set names for the participants
 * conversation.setUserName("Client");
 * conversation.setAgentName("Support");
 *
 * // Add messages to the conversation
 * conversation.addMessage("user", "I need help with my account");
 * conversation.addDirective("Ask for account details");
 *
 * // Get the conversation as a string to feed to an LLM
 * const conversationText = conversation.toString();
 * // Output:
 * // Client: I need help with my account
 * // System: Ask for account details
 * ```
 */
export interface Conversation {
    /**
     * Sets the name of the user in the conversation to be used in {@link toString}.
     * @param name - The name to set for the user.
     */
    setUserName(name: string): void

    /**
     * Sets the name of the AI agent in the conversation to be used in {@link toString}.
     * @param name - The name to set for the agent.
     */
    setAgentName(name: string): void

    /**
     * Sets the default formatter for stringifying messages when toString is called.
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
     * Gets the history of all messages in the conversation.
     * Returns {@link Message} rather than {@link ConversationMessage} because none of the {@link ConversationMessage} properties should be accessed outside of the {@link Conversation} context.
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
    /**
     * Optional token storage object that provides access to authentication tokens.
     * @property {object} tokenStorage - Object containing method to retrieve token.
     * @property {() => Promise<string | null>} tokenStorage.getToken - Function that returns a promise resolving to an authentication token or null.
     */
    tokenStorage?: { getToken: () => Promise<string | null> }
    /**
     * Optional logger instance for handling log messages.
     */
    logger?: Logger
    /**
     * Optional function for sending actions.
     */
    sendAction?: SendAction
    tracer2?: StepTracer
    tracer?: Tracer
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
 *   basePath: '/path/to/prompts'
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
    const stepTracer = cfg.tracer2 || undefined;
    const logger = cfg.logger || globalThis.console
    const tracer = cfg.tracer || createConsoleTracer(logger)
    let apiKey: string | null = null
    const tokenStorage = cfg.tokenStorage || {
        async getToken() {
            if (process.env.OPENAI_API_KEY) {
                return process.env.OPENAI_API_KEY
            }
            throw new Error('OpenAI API key is not set')
        },
    }

    function createWorkflow<CTX>({ onError }: WorkflowConfig<CTX>): Workflow<CTX> {
        let shouldRun = true
        let currentStep = 0
        let beforeEachCallback = async () => Promise.resolve<unknown>(null)
        const attempts = new Map<LLMStep<any>, number>()
        const steps: Array<StringLLMStep<CTX> | JsonLLMStep<CTX, any> | ProgrammaticStep<CTX>> = []
        return {
            terminate: () => {
                logger.debug('AI Engine: Terminating conversation...')
                shouldRun = false
            },
            run: async (messages: Conversation, ctx: any) => {
                for (; currentStep < steps.length; currentStep++) {
                    await beforeEachCallback()
                    const step = steps[currentStep]
                    if (!shouldRun) {
                        break
                    }
                    if (!step.runIf || (await step.runIf(messages, ctx))) {
                        const action = makeAction(cfg.sendAction, 'AI', step.name)
                        await action('started')
                        logger.debug(`AI Engine: Step: ${step.name}`)
                        if ('prompt' in step) {
                            await runStep(step, messages, ctx, onError)
                        } else {
                            await runProgrammaticStep(step, messages, ctx)
                        }
                        await action('completed')
                    }
                }
                return shouldRun ? messages.getProposedReply() : null
            },
            rewindTo: (step: LLMStep<CTX> | ProgrammaticStep<CTX>) => {
                const index = steps.indexOf(step as any)
                if (index === -1) {
                    throw new Error(`Step ${step.name} not found`)
                }
                if (index > currentStep) {
                    throw new Error(`Cannot rewind to a step ahead of the current step`)
                }
                currentStep = index - 1 // -1 because it will be incremented in the loop definition
            },

            beforeEach(callback: () => Promise<unknown>) {
                beforeEachCallback = callback
            },
            addStep(step: StringLLMStep<CTX> | JsonLLMStep<CTX, any> | ProgrammaticStep<CTX>) {
                if ('prompt' in step) {
                    tracer.addStep({
                        name: step.name,
                        prompt: stdPrompt(step.prompt),
                        type: 'text',
                        schema: 'schema' in step ? step.schema : undefined,
                    })
                }
                steps.push(step)
            },
        }

        async function runStep(
            step: StringLLMStep<CTX> | JsonLLMStep<CTX, any>,
            conversation: Conversation,
            ctx: any,
            onError: WorkflowConfig<CTX>['onError'],
        ): Promise<void> {
            if (!apiKey) {
                apiKey = await tokenStorage.getToken()
            }
            if (!apiKey) {
                throw new Error('LLM API key is not provided')
            }
            const stepTrace: StepTrace = { 
                name: step.name, 
                model: step.model, 
                schema: step.json instanceof ZodSchema ? step.json : undefined 
            }
            try {
                stepTrace.receivedContext = ctx
                let response: string | null = null
                let prompt =
                    typeof step.prompt === 'string' ? step.prompt : await step.prompt.content()
                stepTrace.receivedPrompt = prompt
                logger.debug('AI Engine: context', ctx)
                logger.debug(
                    'AI Engine: messages',
                    conversation.toString({ ignoreAddedMessages: step.ignoreAddedMessages }),
                )
                prompt = renderPrompt(prompt, ctx)

                stepTrace.renderedPrompt = prompt
                const stringifiedMessages = conversation.toString({
                    ignoreAddedMessages: step.ignoreAddedMessages,
                })
                stepTrace.stringifiedConversation = stringifiedMessages
                stepTracer?.addStepTrace(stepTrace);
                if ('schema' in step) {
                    response = await runLLM(
                        apiKey,
                        prompt,
                        stringifiedMessages,
                        step.schema,
                        step.model,
                    )
                    response = step.schema.parse(JSON.parse(response))
                } else {
                    response = await runLLM(
                        apiKey,
                        prompt,
                        stringifiedMessages,
                        undefined,
                        step.model,
                    )
                }
                if (!response) {
                    throw new Error('No response from OpenAI')
                }
                logger.debug(`AI Engine: response: ${response}`)
                if (typeof step.shouldExecute === 'function') {
                    if (await step.shouldExecute(response, ctx)) {
                        logger.debug(`AI Engine: executing`)
                        checkAttempts(step)
                        await step.execute(response, conversation, ctx)
                    } else {
                        resetAttempts(step)
                        logger.debug(`AI Engine: skipping`)
                    }
                } else {
                    logger.debug(`AI Engine: replying`)
                    await step.execute(response, conversation, ctx)
                }
            } catch (error) {
                await (step.onError
                    ? step.onError((error as Error).message, ctx)
                    : onError((error as Error).message, ctx))
                // FIXME: this doesn't terminate the workflow
                stepTracer?.addStepTrace(stepTrace);
                shouldRun = false
            }
        }

        async function runProgrammaticStep(
            step: ProgrammaticStep<CTX>,
            messages: Conversation,
            ctx: CTX,
        ) {
            try {
                if (!step.runIf || (await step.runIf(messages, ctx))) {
                    await step.execute(messages, ctx)
                }
            } catch (error) {
                console.error(
                    `AI Engine: error in dumb step ${step.name}: ${(error as Error).message}`,
                )
                await (step.onError
                    ? step.onError((error as Error).message, ctx)
                    : onError((error as Error).message, ctx))
                shouldRun = false
            }
        }

        function checkAttempts(step: LLMStep<any>) {
            if (step.maxAttempts) {
                if (!attempts.has(step)) {
                    attempts.set(step, 0)
                }
                attempts.set(step, attempts.get(step)! + 1)
                if (attempts.get(step)! > step.maxAttempts) {
                    throw new Error(`Max attempts reached for step ${step.name}`)
                }
            }
        }
        function resetAttempts(step: LLMStep<any>) {
            attempts.set(step, 0)
        }
    }

    async function runLLM(
        apiKey: string,
        systemPrompt: string,
        messages: string,
        schema?: ZodSchema,
        model: BasicModel = 'gpt-4o-2024-08-06',
    ) {
        logger.debug('AI Engine: model:', model)
        logger.debug('----------- RENDERED PROMPT ---------------')
        logger.debug(systemPrompt)
        logger.debug('-------------------------------------------')
        if (apiKey === '__TESTING__') {
            await sleep(100)
            if (!schema) {
                return 'canned response'
            }
            return JSON.stringify({ message: 'canned response', reasons: [] })
        }
        const client = new OpenAI({ apiKey })

        const response: OpenAI.Chat.ChatCompletion = await client.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: messages },
            ],
            ...getOpenAiOptions(model, schema),
        })

        if (!response.choices[0].message.content) {
            throw new Error('No response from OpenAI')
        }

        return response.choices[0].message.content
    }

    return {
        createWorkflow,
        createConversation,
        renderPrompt,
    }
}

function getOpenAiOptions(model: BasicModel, schema?: ZodSchema) {
    const options: Omit<ChatCompletionCreateParamsBase, 'messages' | 'stream'> = {
        model,
    }
    const isReasoningModel = ['o3-', 'o1-', 'o1-preview-'].some((m) => model.startsWith(m))
    if (isReasoningModel) {
        if (!model.startsWith('o1-preview-')) {
            options.reasoning_effort = 'high'
        }
    } else {
        options.temperature = 0.1
    }

    if (schema) {
        options.response_format = {
            type: 'json_schema',
            json_schema: {
                name: 'detector_response',
                schema: zodToJsonSchema(schema),
            },
        }
    } else {
        options.response_format = { type: 'text' }
    }

    return options
}

function renderPrompt(prompt: string, context?: Record<string, unknown>): string {
    nunjucks.configure({
        autoescape: false,
        trimBlocks: true,
        lstripBlocks: true,
    })
    return nunjucks.renderString(prompt, context || {})
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
        setUserName: (name: string) => {
            names.user = name
        },
        setAgentName: (name: string) => {
            names.agent = name
        },
    }
}
