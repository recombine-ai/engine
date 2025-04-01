// cspell:words lstripBlocks
import fs from 'fs'
import OpenAI from 'openai'
import { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions'
import { join } from 'path'
import nunjucks from 'nunjucks'
import { ZodSchema } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { Logger, Message } from './interfaces'
import { makeAction, SendAction } from './bosun/action'
import { sleep } from 'openai/core'

export type Models =
    | 'o3-mini-2025-01-31'
    | 'o1-preview-2024-09-12'
    | 'gpt-4o-2024-11-20'
    | 'o1-2024-12-17'

export interface BasicStep {
    /** Step name (used mainly for debugging) */
    name: string

    /** Check a condition, whether the whole step should be run or not */
    runIf?: (messages: Messages) => boolean | Promise<boolean>

    /** Use when you need to do some action when LLM's response received */
    execute: () => Promise<unknown>

    /** Error handler called if an error occurred during LLM API call or in `execute` function */
    onError: (error: string) => Promise<unknown>
}

export interface Step {
    /** Step name (used mainly for debugging) */
    name: string

    /** Check a condition, whether the whole step should be run or not */
    runIf?: (messages: Messages) => boolean | Promise<boolean>

    /** Specify AI Model. Default gpt-4o */
    model?: Models

    /**
     * Prompt can be a simple string or a link to a file, loaded with `loadFile` function which
     * takes a path to the file relative to `src/use-cases` directory.
     */
    prompt: string | File

    /**
     * In case you want a structured output from LLM, define a schema using {@link zod https://zod.dev/}
     * library.
     */
    schema?: ZodSchema

    /** Exclude directives from message history for this step */
    ignoreDirectives?: boolean

    /** Additional data to be inserted into prompt */
    context?: Record<string, unknown>

    /** Use when you need to do some action when LLM's response received */
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

export type CreateStep = ReturnType<typeof createAIEngine>['createStep']

export type CreateWorkflow = ReturnType<typeof createAIEngine>['createWorkflow']

export type LoadFile = ReturnType<typeof createAIEngine>['loadFile']

export type MakeMessagesList = ReturnType<typeof createAIEngine>['makeMessagesList']

export type AiEngine = {
    createWorkflow: CreateWorkflow
    createStep: CreateStep
    loadFile: LoadFile
    makeMessagesList: MakeMessagesList
}

export interface Messages {
    setUserName(name: string): void
    setAgentName(name: string): void
    toString: (ignoreDirectives?: boolean) => string
    addDirective: (message: string) => void
    addMessage: (name: Message['sender'], message: string) => void
    directiveFormat: (formatter: (message: Message) => string) => void
    proposedMessageFormat: (formatter: (message: string) => string) => void
    setProposedReply: (message: string) => void
    getProposedReply: () => string | null
    getHistory: () => Message[]
}
export interface File {
    content: () => Promise<string>
}

export interface EngineConfig {
    tokenStorage?: { getToken: () => Promise<string | null> }
    basePath?: string
    logger?: Logger
    sendAction?: SendAction
}

export function createAIEngine(cfg: EngineConfig = {}) {
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
    function createStep<T extends Step | BasicStep>(step: T): T {
        return step
    }

    function makeMessagesList(messages: Message[] = []): Messages {
        let directivesFormatter = (message: Message) => `${message.sender}: ${message.text}`
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
                            return ignoreDirectives ? null : directivesFormatter(msg)
                        }
                        return `${names[msg.sender]}: ${msg.text}`
                    })
                    .filter((msg) => msg !== null)
                    .join('\n') + (proposedReply ? `\n${proposedFormatter(proposedReply)}` : ''),
            addMessage: (sender: Message['sender'], text: string) =>
                messages.push({ sender, text }),
            addDirective: (message: string) => {
                logger.debug(`AI Engine: add directive: ${message}`)
                messages.push({ sender: 'system', text: message })
            },
            directiveFormat: (formatter: (msg: Message) => string) => {
                directivesFormatter = formatter
            },
            proposedMessageFormat: (formatter: (msg: string) => string) => {
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

    async function createWorkflow(...steps: Array<Step | BasicStep>) {
        const apiKey = await tokenStorage.getToken()
        let shouldRun = true
        let currentStep = 0
        let beforeEachCallback = async () => Promise.resolve<unknown>(null)
        const attempts = new Map<Step, number>()
        return {
            terminate: () => {
                logger.debug('AI Engine: Terminating conversation...')
                shouldRun = false
            },
            run: async (messages: Messages) => {
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
                            await runStep(step, messages)
                        } else {
                            await runDumbStep(step, messages)
                        }
                        await action('completed')
                    }
                }
                return shouldRun ? messages.getProposedReply() : null
            },
            rewindTo: (step: Step) => {
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

        async function runStep(step: Step, messages: Messages) {
            if (!apiKey) {
                throw new Error('OpenAI API key is not set')
            }
            try {
                let response: string | null = null
                let prompt =
                    typeof step.prompt === 'string' ? step.prompt : await step.prompt.content()
                logger.debug('AI Engine: context', step.context)
                logger.debug(
                    'AI Engine: messages',
                    messages.toString(step.ignoreDirectives || false),
                )
                if (step.context) {
                    nunjucks.configure({ autoescape: true, trimBlocks: true, lstripBlocks: true })
                    prompt = nunjucks.renderString(prompt, step.context)
                }

                response = await runLLM(
                    apiKey,
                    prompt,
                    messages.toString(step.ignoreDirectives || false),
                    step.schema,
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
            } catch (error) {
                // FIXME: this doesn't terminate the workflow
                await step.onError((error as Error).message)
                shouldRun = false
            }
        }

        async function runDumbStep(step: BasicStep, messages: Messages) {
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

        function checkAttempts(step: Step) {
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
        function resetAttempts(step: Step) {
            attempts.set(step, 0)
        }
    }

    async function runLLM(
        apiKey: string,
        systemPrompt: string,
        messages: string,
        schema?: ZodSchema,
        model: Models = 'gpt-4o-2024-11-20',
    ) {
        logger.debug('AI Engine: model:', model)
        logger.debug('----------- RENDERED PROMPT ---------------')
        logger.debug(systemPrompt)
        logger.debug('-------------------------------------------')
        if (apiKey === '__TESTING__') {
            await sleep(100)
            return schema
                ? JSON.stringify({ message: 'canned response', reasons: [] })
                : 'canned response'
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
        makeMessagesList,
    }
}

function getOpenAiOptions(model: Models, schema?: ZodSchema) {
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
