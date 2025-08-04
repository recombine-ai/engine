// cspell:words lstripBlocks
import fs from 'fs'
import OpenAI from 'openai'
import { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions'
import { join } from 'path'
import nunjucks from 'nunjucks'
import { ZodSchema } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { Logger } from './interfaces'
import { makeAction, SendAction } from './bosun/action'
import { sleep } from 'openai/core'

export namespace AIEngine {
    /**
     * Represents a basic model name for LLMs.
     */
    export type BasicModel =
        | 'o3-mini-2025-01-31'
        | 'o1-preview-2024-09-12'
        | 'gpt-4o-2024-11-20'
        | 'o1-2024-12-17'
        | (string & {}) // prevents compiler from simplifying the type to just `string`

    export interface ProgrammaticStep {
        /** Step name for debugging */
        name: string

        /** Determines if the step should be run or not */
        runIf?: (messages: Conversation) => boolean | Promise<boolean>

        /** Content of the step */
        execute: () => Promise<unknown>

        /** Error handler called if an error occurred during in `execute` function */
        onError: (error: string) => Promise<unknown>
    }

    export interface LLMStep {
        /** Step name for debugging */
        name: string

        /** Determines if the step should be run or not */
        runIf?: (messages: Conversation) => boolean | Promise<boolean>

        /** LLM to use. Defaults to gpt-4o */
        model?: BasicModel

        /**
         * Prompt can be a simple string or a link to a file, loaded with `loadFile` function which
         * takes a path to the file relative to `src/use-cases` directory. Should be Nunjucks-compatible.
         */
        prompt: string | File

        /**
         * Defines the expected structure of the LLM's output.
         * Accepts either a boolean (for plain text or JSON responses) or a ZodSchema, which is automatically
         * converted to a JSON schema. When provided, the LLM's response is validated and parsed according
         * to this schema ensuring reliable structured output.
         */
        json: boolean | ZodSchema

        /** Exclude directives from message history passed to the LLM for this step */
        ignoreDirectives?: boolean

        /**
         * Additional data to be inserted into the prompt. Accessible via Nunjucks variables.
         * @example
         * ```
         * prompt: "Hello {{ name }}, your score is {{ score }}"
         * context: { name: "John", score: 42 }
         * ```
         */
        context?: Record<string, unknown>

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
        execute: (reply: string) => Promise<unknown>

        /**
         * Check a condition, whether the `execute` function should run or not
         * @deprecated use `runIf` to check if the step should be run, use if in `execute` to check
         * if it should be executed
         **/
        shouldExecute?: (reply: string) => boolean | Promise<boolean>

        /**
         * When provided, throws an error if the step is invoked more times than `maxAttempts`.
         * Number of attempts taken is reset when `shouldExecute` returns `false`. Useful to limit
         * rewinds by reviewers. NOTE that it doesn't work on steps without `shouldExecute` method.
         */
        maxAttempts?: number

        /** Error handler called if an error occurred during LLM API call or in `execute` function */
        onError: (error: string) => Promise<unknown>
    }

    /**
     * A useful trace of a step execution. It's properties are filled during the execution. There is no guarantee that any of them will be filled.
     */
    export type StepTrace = {
        renderedPrompt?: string;
        receivedContext?: Record<string, unknown>;
        receivedPrompt?: string;
        stringifiedConversation?: string
    }

    /**
     * An AI workflow composed of steps.
     */
    export interface Workflow {
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
        run: (messages: Conversation) => Promise<{ reply: string | null; trace: { steps: Record<string, StepTrace>; } }>

        /**
         * Rewinds the workflow execution to a specific step.
         * @param step - The step to rewind to
         */
        rewindTo: (step: LLMStep | ProgrammaticStep) => void

        /**
         * Registers a callback to be executed before each step.
         * @param callback - Async function to execute before each step
         */
        beforeEach: (callback: () => Promise<unknown>) => void
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
         * @param steps - An array of LLM or programmatic steps to be executed in order.
         * @returns A Promise that resolves to the created Workflow.
         */
        createWorkflow: (...steps: Array<LLMStep | ProgrammaticStep>) => Promise<Workflow>;

        /**
         * Creates a step that can be used in a workflow.
         * @param step - The LLM or programmatic step to create.
         * @returns The created step of the same type as the input.
         */
        createStep: <T extends LLMStep | ProgrammaticStep>(step: T) => T;

        /**
         * Loads a file from the specified path.
         * @param path - The path to the file to load.
         * @returns The loaded File object.
         */
        loadFile: (path: string) => File;

        /**
         * Creates a new conversation instance.
         * @param messages - Optional initial messages for the conversation.
         * @returns A new Conversation object.
         */
        createConversation: (messages?: Message[]) => Conversation;

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
         * Converts the conversation to a string representation to be fed to an LLM.
         * @param ignoreDirectives - Whether to ignore directives in the string output.
         * @returns The string representation of the conversation.
         */
        toString: (ignoreDirectives?: boolean) => string

        /**
         * Adds a directive message to the conversation.
         * @param message - The directive message to add.
         * @example
         * ```
         * // Add a directive to guide the LLM response
         * conversation.addDirective("Ask the user for their preferred date and time for the reservation");
         * 
         * // The resulting conversation string might look like:
         * // User: I'd like to book a table at your restaurant.
         * // System: Ask the user for their preferred date and time for the reservation
         * ```
         */
        addDirective: (message: string, formatter?: (message: Message) => string) => void

        /**
         * Adds a message from a specified sender to the conversation.
         * @param name - The sender of the message.
         * @param message - The content of the message.
         */
        addMessage: (name: Message['sender'], message: string) => void

        /**
         * Sets a custom formatter for directive messages.
         * @param formatter - A function that takes a Message and returns a formatted string.
         */
        setDefaultDirectiveFormatter: (formatter: (message: Message) => string) => void

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
        formatter?: (message: Message) => string
    }

    export interface File {
        content: () => Promise<string>
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
         * Optional base URL path for resolving paths to prompts.
         */
        basePath?: string
        /**
         * Optional logger instance for handling log messages.
         */
        logger?: Logger
        /**
         * Optional function for sending actions.
         */
        sendAction?: SendAction
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
        const logger = cfg.logger || globalThis.console
        const basePath = cfg.basePath || process.cwd()
        const tokenStorage = cfg.tokenStorage || {
            async getToken() {
                if (process.env.OPENAI_API_KEY) {
                    return process.env.OPENAI_API_KEY
                }
                throw new Error('OpenAI API key is not set')
            },
        }
        function createStep<T extends LLMStep | ProgrammaticStep>(step: T): T {
            return step
        }

        function getConversation(messages: Message[] = []): Conversation {
            let defaultDirectivesFormatter = (message: Message) => `${message.sender}: ${message.text}`
            let proposedFormatter = (message: string) => `Proposed reply: ${message}`
            let proposedReply: string | null = null
            const names: Record<Message['sender'], string> = {
                agent: 'Agent',
                user: 'User',
                system: 'System',
            }
            return {
                toString: (ignoreDirectives = false) =>
                    messages
                        .map((msg) => {
                            if (msg.sender === 'system') {
                                logger.debug('formatter', msg.formatter);
                                return ignoreDirectives ? null : (msg.formatter ? msg.formatter(msg) : defaultDirectivesFormatter(msg))
                            }
                            return `${names[msg.sender]}: ${msg.text}`
                        })
                        .filter((msg) => msg !== null)
                        .join('\n') +
                    (proposedReply ? `\n${proposedFormatter(proposedReply)}` : ''),
                addMessage: (sender: Message['sender'], text: string) =>
                    messages.push({ sender, text }),
                addDirective: (message: string, formatter?: (message: Message) => string) => {
                    logger.debug(`AI Engine: add directive: ${message}`)
                    messages.push({ sender: 'system', text: message, formatter })
                },
                setDefaultDirectiveFormatter: (formatter: (msg: Message) => string) => {
                    defaultDirectivesFormatter = formatter
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

        async function createWorkflow(
            ...steps: Array<LLMStep | ProgrammaticStep>
        ): Promise<Workflow> {
            const apiKey = await tokenStorage.getToken()
            let shouldRun = true
            let currentStep = 0
            let beforeEachCallback = async () => Promise.resolve<unknown>(null)
            const attempts = new Map<LLMStep, number>();
            const trace = {
                steps: steps.reduce((acc, step) => {
                    acc[step.name] = {};
                    return acc;
                }, {} as Record<string, StepTrace>)
            };
            return {
                terminate: () => {
                    logger.debug('AI Engine: Terminating conversation...')
                    shouldRun = false
                },
                run: async (messages: Conversation) => {
                    for (; currentStep < steps.length; currentStep++) {
                        await beforeEachCallback()
                        const step = steps[currentStep]
                        if (!shouldRun) {
                            break
                        }
                        if (!step.runIf || (await step.runIf(messages))) {
                            const action = makeAction(cfg.sendAction, 'AI', step.name)
                            await action('started')
                            logger.debug(`AI Engine: Step: ${step.name}`)
                            if ('prompt' in step) {
                                const stepTrace = await runStep(step, messages)
                                trace.steps[step.name] = stepTrace;
                            } else {
                                await runDumbStep(step, messages)
                            }
                            await action('completed')
                        }
                    }
                    return {
                        reply: shouldRun ? messages.getProposedReply() : null,
                        trace
                    }
                },
                rewindTo: (step: LLMStep | ProgrammaticStep) => {
                    const index = steps.indexOf(step)
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
            }

            async function runStep(step: LLMStep, messages: Conversation): Promise<StepTrace> {
                if (!apiKey) {
                    throw new Error('OpenAI API key is not set')
                }
                const stepTrace: StepTrace = {};
                try {
                    stepTrace.receivedContext = step.context;
                    let response: string | null = null
                    let prompt =
                        typeof step.prompt === 'string' ? step.prompt : await step.prompt.content()
                    stepTrace.receivedPrompt = prompt;
                    logger.debug('AI Engine: context', step.context)
                    logger.debug(
                        'AI Engine: messages',
                        messages.toString(step.ignoreDirectives || false),
                    )
                    prompt = renderPrompt(prompt, step.context);

                    stepTrace.renderedPrompt = prompt;
                    const stringifiedMessages = messages.toString(step.ignoreDirectives || false);
                    stepTrace.stringifiedConversation = stringifiedMessages;
                    response = await runLLM(
                        apiKey,
                        prompt,
                        stringifiedMessages,
                        step.json,
                        step.model,
                    )
                    if (!response) {
                        throw new Error('No response from OpenAI')
                    }
                    logger.debug(`AI Engine: response: ${response}`)
                    if (typeof step.shouldExecute === 'function') {
                        if (await step.shouldExecute(response)) {
                            logger.debug(`AI Engine: executing`)
                            checkAttempts(step)
                            await step.execute(response)
                        } else {
                            resetAttempts(step)
                            logger.debug(`AI Engine: skipping`)
                        }
                    } else {
                        logger.debug(`AI Engine: replying`)
                        await step.execute(response)
                    }
                    return stepTrace;
                } catch (error) {
                    // FIXME: this doesn't terminate the workflow
                    await step.onError((error as Error).message)
                    shouldRun = false
                    return stepTrace;
                }
            }

            async function runDumbStep(step: ProgrammaticStep, messages: Conversation) {
                try {
                    if (!step.runIf || (await step.runIf(messages))) {
                        await step.execute()
                    }
                } catch (error) {
                    console.error(
                        `AI Engine: error in dumb step ${step.name}: ${(error as Error).message}`,
                    )
                    await step.onError((error as Error).message)
                    shouldRun = false
                }
            }

            function checkAttempts(step: LLMStep) {
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
            function resetAttempts(step: LLMStep) {
                attempts.set(step, 0)
            }
        }

        async function runLLM(
            apiKey: string,
            systemPrompt: string,
            messages: string,
            json: boolean | ZodSchema,
            model: BasicModel = 'gpt-4o-2024-08-06',
        ) {
            logger.debug('AI Engine: model:', model)
            logger.debug('----------- RENDERED PROMPT ---------------')
            logger.debug(systemPrompt)
            logger.debug('-------------------------------------------')
            if (apiKey === '__TESTING__') {
                await sleep(100)
                if (typeof json === 'boolean') {
                    return json ? JSON.stringify({ message: 'canned response', reasons: [] }) : 'canned response'
                }
                return JSON.stringify({ message: 'canned response', reasons: [] })
            }
            const client = new OpenAI({ apiKey })

            const response: OpenAI.Chat.ChatCompletion = await client.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: messages },
                ],
                ...getOpenAiOptions(
                    model,
                    json
                ),
            })

            if (!response.choices[0].message.content) {
                throw new Error('No response from OpenAI')
            }

            return response.choices[0].message.content
        }

        function loadFile(path: string) {
            // NOTE: there probably will be S3 loading stuff here

            return {
                content: async () => {
                    logger.debug('AI Engine: loading prompt:', path)
                    return fs.promises.readFile(join(basePath, path), 'utf-8')
                },
            }
        }

        return {
            createWorkflow: createWorkflow,
            createStep,
            loadFile,
            createConversation: getConversation,
            renderPrompt
        }
    }

    function getOpenAiOptions(model: BasicModel, json: boolean | ZodSchema) {
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

        if (typeof json !== 'boolean') {
            options.response_format = {
                type: 'json_schema',
                json_schema: {
                    name: 'detector_response',
                    schema: zodToJsonSchema(json),
                },
            }
        } else if (json) {
            options.response_format = { type: 'json_object' }
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
}
