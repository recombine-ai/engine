import { describe, it, expect, vi, Mock } from 'vitest'
import { createAIEngine } from './ai'
import { PromptFile } from './prompt-fs'
import { z } from 'zod'
import { createOpenAIAdapter } from './llm-adapters/openai'

// Mock OpenAI at the top level
// NOTE ABOUT OPENAI_API_KEY in tests:
// - For tests that need to inspect arguments passed to OpenAI (via mocking),
//   we must avoid the adapter's __TESTING__ short-circuit and prevent a missing
//   API key error. Setting OPENAI_API_KEY to a non-__TESTING__ value (e.g. 'mocked')
//   satisfies both.
// - For tests that don't need to hit the mocked client (just canned behavior),
//   we set OPENAI_API_KEY='__TESTING__' so the adapter returns canned responses.
vi.mock('openai', () => {
    const mockOpeAi = vi.fn(() => ({
        chat: {
            completions: {
                create: vi.fn(),
            },
        },
    }))
    return {
        OpenAI: mockOpeAi,
        default: mockOpeAi,
    }
})

describe('conversationExample', () => {
    it('outputs conversation string ignoring added messages', () => {
        const engine = createAIEngine()
        const conversation = engine.createConversation([
            {
                sender: 'user',
                text: 'Hello, I need help with my order.',
            },
            {
                sender: 'agent',
                text: 'Sure, I can help you with that.',
            },
        ])

        conversation.setUserName('Client')
        conversation.setAgentName('Support')
        conversation.addMessage({ sender: 'user', text: 'I need help with my account' })
        conversation.addMessage({ sender: 'system', text: 'Ask for account details' })
        conversation.setProposedReply('Please provide your account number')

        const outputIgnoringAdded = conversation.toString({ ignoreAddedMessages: true })
        const expectedIgnoring = [
            'Client: Hello, I need help with my order.',
            'Support: Sure, I can help you with that.',
            'Proposed reply: Please provide your account number',
        ].join('\n')
        expect(outputIgnoringAdded).toBe(expectedIgnoring)
    })

    it('outputs full conversation string including added messages and proposed reply', () => {
        const engine = createAIEngine()
        const conversation = engine.createConversation([
            {
                sender: 'user',
                text: 'Hello, I need help with my order.',
                imageUrl: 'https://example.com/image.png',
            },
            {
                sender: 'agent',
                text: 'Sure, I can help you with that.',
                imageUrl: 'https://example.com/agent-image.png',
            },
        ])

        conversation.setUserName('Client')
        conversation.setAgentName('Support')
        conversation.addMessage({ sender: 'user', text: 'I need help with my account' })
        conversation.addMessage({ sender: 'system', text: 'Ask for account details' })
        conversation.setProposedReply('Please provide your account number')

        const outputFull = conversation.toString()
        const expectedFull = [
            'Client: Hello, I need help with my order.',
            'Support: Sure, I can help you with that.',
            'Client: I need help with my account',
            'System: Ask for account details',
            'Proposed reply: Please provide your account number',
        ].join('\n')
        expect(outputFull).toBe(expectedFull)
    })
})

describe('workflow.run', () => {
    it('runs all steps', async () => {
        process.env.OPENAI_API_KEY = '__TESTING__'
        const { ai, step, cnv } = getAi()

        const dumbStep = step({
            name: 'dumb-step',
            runIf: vi.fn(() => true),
            execute: vi.fn(),
        })
        const mainPrompt = { content: vi.fn(() => 'hello') } as any as PromptFile
        const mainStep = step({
            name: 'main',
            prompt: mainPrompt,
            execute: vi.fn(),
        })
        const smartStep = step({
            name: 'smart-step',
            runIf: vi.fn(() => true),
            schema: z.object({}),
            prompt: { content: vi.fn(() => 'hello') } as any as PromptFile,
            execute: vi.fn(),
        })
        const wf = ai.createWorkflow({
            steps: [dumbStep],
            onError,
        })
        wf.addStep(mainStep)
        wf.addStep(smartStep)

        const ctx = {}
        const wfHandle = expect.objectContaining({
            terminate: expect.any(Function),
            rewindTo: expect.any(Function),
        })
        await wf.run(cnv, ctx)
        expect(dumbStep.runIf).toBeCalledWith(cnv, ctx)
        expect(dumbStep.execute).toBeCalledWith(cnv, ctx, wfHandle)
        expect(mainPrompt.content).toBeCalled()
        expect(mainStep.execute).toBeCalledWith(expect.any(String), cnv, ctx, wfHandle)
        expect(smartStep.runIf).toBeCalled()
        expect(smartStep.execute).toBeCalledWith(expect.any(Object), cnv, ctx, wfHandle)
    })

    it('executes smart steps with parsed response', async () => {
        // We set a non-__TESTING__ value so the adapter does not short-circuit
        // and we can assert the exact payload passed to OpenAI's client.
        const prev = process.env.OPENAI_API_KEY
        process.env.OPENAI_API_KEY = 'mocked'
        const { OpenAI } = (await import('openai')) as any as { OpenAI: Mock }
        OpenAI.mockReturnValue({
            chat: {
                completions: {
                    create: vi.fn(() => ({
                        choices: [
                            {
                                message: {
                                    content: JSON.stringify({ name: 'John', age: 30 }),
                                },
                            },
                        ],
                    })),
                },
            },
        })
        const ai = createAIEngine({
            logger: { ...console, debug: noop, error: noop },
        })
        const step = ai.getStepBuilder()
        const cnv = ai.createConversation([])

        const testSchema = z.object({
            name: z.string(),
            age: z.number(),
        })

        const smartStep = step({
            name: 'smart-step',
            schema: testSchema,
            prompt: 'Get user info',
            execute: vi.fn(),
        })

        const wf = ai.createWorkflow({
            steps: [smartStep],
            onError,
        })

        await wf.run(cnv, {})
        process.env.OPENAI_API_KEY = prev

        expect(smartStep.execute).toBeCalledWith(
            { name: 'John', age: 30 },
            cnv,
            {},
            expect.any(Object),
        )
    })

    it('passes explicit adapter options to OpenAI', async () => {
        // Use a non-__TESTING__ value to force client invocation and inspect options
        const prev = process.env.OPENAI_API_KEY
        process.env.OPENAI_API_KEY = 'mocked'
        const { OpenAI } = (await import('openai')) as any as { OpenAI: Mock }
        const createMock = vi.fn().mockResolvedValue({
            choices: [
                {
                    message: { content: 'ok' },
                },
            ],
        })
        OpenAI.mockReturnValue({
            chat: { completions: { create: createMock } },
        })

        const ai = createAIEngine({ logger: { ...console, debug: noop, error: noop } })
        const step = ai.getStepBuilder()
        const cnv = ai.createConversation([])

        const options = {
            model: 'gpt-4o-2024-08-06',
            temperature: 0.55,
            user: 'tester',
            max_tokens: 11,
        }
        const llm = createOpenAIAdapter(options, {
            tokenStorage: {
                async getToken() {
                    return process.env.OPENAI_API_KEY || null
                },
            },
        })
        const s = step({ name: 's', prompt: 'P', model: llm, execute: vi.fn() })
        const wf = ai.createWorkflow({ steps: [s], onError })
        await wf.run(cnv, {})

        expect(createMock).toBeCalledWith(
            expect.objectContaining({
                temperature: 0.55,
                user: 'tester',
                max_tokens: 11,
                model: 'gpt-4o-2024-08-06',
            }),
        )
        process.env.OPENAI_API_KEY = prev
    })

    it('adds adapter options to step trace model as JSON string', async () => {
        const stepTracer = { addStepTrace: vi.fn() }
        const ai = createAIEngine({
            stepTracer,
            logger: { ...console, debug: noop, error: noop },
        })
        const step = ai.getStepBuilder()
        const cnv = ai.createConversation([])

        const options = { model: 'gpt-4o-2024-08-06', temperature: 0.2 }
        const adapter = {
            getOptions: () => options,
            generateResponse: async () => 'ok',
        }

        const s = step({ name: 's', prompt: 'P', model: adapter, execute: vi.fn() })
        const wf = ai.createWorkflow({ steps: [s], onError })
        await wf.run(cnv, {})

        expect(stepTracer.addStepTrace).toBeCalled()
        const firstCallArg = (stepTracer.addStepTrace as Mock).mock.calls[0][0]
        expect(firstCallArg.model).toBe(JSON.stringify(options))
    })

    it('is backward compatible: string model uses defaults (no schema)', async () => {
        // String model path: force client invocation to observe defaults
        const prev = process.env.OPENAI_API_KEY
        process.env.OPENAI_API_KEY = 'mocked'
        const { OpenAI } = (await import('openai')) as any as { OpenAI: Mock }
        const createMock = vi.fn().mockResolvedValue({
            choices: [
                {
                    message: { content: 'ok' },
                },
            ],
        })
        OpenAI.mockReturnValue({
            chat: { completions: { create: createMock } },
        })

        const ai = createAIEngine({ logger: { ...console, debug: noop, error: noop } })
        const step = ai.getStepBuilder()
        const cnv = ai.createConversation([])

        const s = step({ name: 's', model: 'gpt-4o-2024-08-06', prompt: 'P', execute: vi.fn() })
        const wf = ai.createWorkflow({ steps: [s], onError })
        await wf.run(cnv, {})

        expect(createMock).toBeCalledWith(
            expect.objectContaining({
                model: 'gpt-4o-2024-08-06',
                temperature: 0.1,
                response_format: { type: 'text' },
            }),
        )
        process.env.OPENAI_API_KEY = prev
    })

    it('is backward compatible: omitted model uses default model and JSON schema formatting', async () => {
        // Omitted model path with schema: ensure JSON schema formatting defaults
        const prev = process.env.OPENAI_API_KEY
        process.env.OPENAI_API_KEY = 'mocked'
        const { OpenAI } = (await import('openai')) as any as { OpenAI: Mock }
        const createMock = vi.fn().mockResolvedValue({
            choices: [
                {
                    message: { content: JSON.stringify({ foo: 1 }) },
                },
            ],
        })
        OpenAI.mockReturnValue({
            chat: { completions: { create: createMock } },
        })

        const ai = createAIEngine({ logger: { ...console, debug: noop, error: noop } })
        const step = ai.getStepBuilder()
        const cnv = ai.createConversation([])

        const schema = z.object({ foo: z.number() })
        const s = step({ name: 's', schema, prompt: 'P', execute: vi.fn() })
        const wf = ai.createWorkflow({ steps: [s], onError })
        await wf.run(cnv, {})

        expect(createMock).toBeCalledWith(
            expect.objectContaining({
                model: 'gpt-4o-2024-08-06',
                response_format: expect.objectContaining({ type: 'json_schema' }),
            }),
        )
        process.env.OPENAI_API_KEY = prev
    })

    describe('workflow handle', () => {
        it('terminates the workflow', async () => {
            process.env.OPENAI_API_KEY = '__TESTING__'
            const { ai, step, cnv } = getAi()
            const firstStep = step({
                name: 'first-step',
                runIf: () => true,
                execute: async (_, __, wfHandle) => {
                    wfHandle.terminate()
                },
            })

            const secondStep = step({
                name: 'second-step',
                runIf: () => true,
                execute: vi.fn(),
            })

            const wf = ai.createWorkflow({
                steps: [firstStep, secondStep],
                onError,
            })
            await wf.run(cnv)

            expect(secondStep.execute).not.toHaveBeenCalled()
        })
        it('rewinds to the specified step', async () => {
            process.env.OPENAI_API_KEY = '__TESTING__'
            const { ai, step, cnv } = getAi()

            let secondStepCalled = false

            const firstStep = step({
                name: 'first-step',
                runIf: () => true,
                execute: vi.fn(),
            })

            const secondStep = step({
                name: 'second-step',
                runIf: () => !secondStepCalled,
                execute: async (_, __, wfHandle) => {
                    secondStepCalled = true
                    wfHandle.rewindTo('first-step')
                },
            })

            const wf = ai.createWorkflow({
                steps: [firstStep, secondStep],
                onError,
            })

            await wf.run(cnv, {})

            expect(firstStep.execute).toBeCalledTimes(2)
        })
        it('rewinds up to maxAttempts', async () => {
            process.env.OPENAI_API_KEY = '__TESTING__'
            const { ai, step, cnv } = getAi()
            const mockOnError = vi.fn()

            const firstStep = step({
                name: 'first-step',
                runIf: () => true,
                maxAttempts: 3,
                execute: vi.fn(),
            })

            const secondStep = step({
                name: 'second-step',
                runIf: () => true,
                execute: async (_, __, wfHandle) => {
                    wfHandle.rewindTo('first-step')
                },
            })

            const wf = ai.createWorkflow({
                steps: [firstStep, secondStep],
                onError: mockOnError,
            })

            await wf.run(cnv, {})

            expect(firstStep.execute).toBeCalledTimes(3)
            expect(mockOnError).toHaveBeenCalledOnce()
        })
        it('resets the counter when passed to the next step', async () => {
            process.env.OPENAI_API_KEY = '__TESTING__'
            const { ai, step, cnv } = getAi()
            const mockOnError = vi.fn()

            const firstStep = step({
                name: 'first-step',
                runIf: () => true,
                maxAttempts: 3,
                execute: vi.fn(),
            })

            let counter = 0
            const secondStep = step({
                name: 'second-step',
                runIf: () => true,
                execute: async (_, __, wfHandle) => {
                    if (counter < 2) {
                        wfHandle.rewindTo('first-step')
                    }
                    counter++
                },
            })

            const thirdStep = step({
                name: 'third-step',
                runIf: () => true,
                execute: async (_, __, wfHandle) => {
                    wfHandle.rewindTo('first-step')
                },
            })

            const wf = ai.createWorkflow({
                steps: [firstStep, secondStep, thirdStep],
                onError: mockOnError,
            })

            await wf.run(cnv, {})

            expect(firstStep.execute).toBeCalledTimes(5)
            expect(mockOnError).toHaveBeenCalledOnce()
        })
    })

    describe('tracer', () => {
        it('adds all steps', async () => {
            const tracer = { addStep: vi.fn() }
            const { ai, step } = getAi(tracer)

            const firstStep = step({
                name: 'first-step',
                prompt: '',
                runIf: () => true,
                execute: vi.fn(),
            })

            const secondStep = step({
                name: 'second-step',
                prompt: '',
                runIf: () => true,
                execute: vi.fn(),
            })

            const thirdStep = step({
                name: 'third-step',
                prompt: '',
                runIf: () => true,
                execute: vi.fn(),
            })

            const wf = ai.createWorkflow({
                steps: [firstStep, secondStep],
                onError: noopA,
            })
            wf.addStep(thirdStep)

            expect(tracer.addStep).toBeCalledTimes(3)
        })
    })

    describe('stepTracer integration', () => {
        function makeStepTracer() {
            return {
                addStepTrace: vi.fn(),
                flush: vi.fn(() => Promise.resolve()),
                createStepTrace: vi.fn((trace: any) => ({ ...trace })),
            }
        }
        function makeAi(stepTracer: ReturnType<typeof makeStepTracer>) {
            return createAIEngine({
                logger: { ...console, debug: vi.fn(), error: vi.fn() },
                tokenStorage: { getToken: () => Promise.resolve('__TESTING__') },
                stepTracer,
            })
        }
        it('records a basic string LLM step trace before execution and flushes after run', async () => {
            const stepTracer = makeStepTracer()
            const engine = makeAi(stepTracer)
            const step = engine.getStepBuilder()({
                name: 'hello-step',
                prompt: 'Say hello',
                execute: vi.fn(),
            })
            const wf = engine.createWorkflow({
                steps: [step],
                onError: async () => {},
                workflowId: 'wf-1',
            })
            const conversation = engine.createConversation([])
            await wf.run(conversation, { foo: 'bar' })

            expect(stepTracer.addStepTrace).toHaveBeenCalledTimes(1)
            const trace = stepTracer.addStepTrace.mock.calls[0][0]
            expect(trace.name).toBe('hello-step')
            expect(trace.workflowId).toBe('wf-1')
            expect(trace.renderedPrompt).toBeDefined()
            expect(trace.receivedPrompt).toBe('Say hello')
            expect(trace.stringifiedConversation).toBeDefined()
            expect(stepTracer.flush).toHaveBeenCalledTimes(1)
        })
        it('includes schema in trace for JSON steps and parses response', async () => {
            const stepTracer = makeStepTracer()
            const engine = makeAi(stepTracer)
            const schema = z.object({ message: z.string(), reasons: z.array(z.string()) })
            const jsonStep = engine.getStepBuilder()({
                name: 'json-step',
                prompt: 'Give json',
                schema,
                execute: vi.fn(),
            })
            const wf = engine.createWorkflow({ steps: [jsonStep], onError: async () => {} })
            const conversation = engine.createConversation([])
            await wf.run(conversation, {})

            expect(stepTracer.addStepTrace).toHaveBeenCalledTimes(1)
            const trace = stepTracer.addStepTrace.mock.calls[0][0]
            expect(trace.schema).toBe(schema)
            expect(jsonStep.execute).toHaveBeenCalledWith(
                { message: 'canned response', reasons: [] },
                conversation,
                {},
                expect.any(Object),
            )
        })
        it('adds second trace on error path and terminates', async () => {
            const stepTracer = makeStepTracer()
            const engine = makeAi(stepTracer)
            const failingStep = engine.getStepBuilder()({
                name: 'fail-step',
                prompt: 'Cause an error',
                execute: vi.fn(() => {
                    throw new Error('boom')
                }),
                onError: vi.fn(),
            })
            const wf = engine.createWorkflow({ steps: [failingStep], onError: async () => {} })
            const conversation = engine.createConversation([])
            const result = await wf.run(conversation, {})

            expect(stepTracer.addStepTrace).toHaveBeenCalledTimes(2)
            expect(failingStep.onError).toHaveBeenCalled()
            expect(result).toBeNull()
        })
        it('does not trace programmatic steps (no prompt property)', async () => {
            const stepTracer = makeStepTracer()
            const engine = makeAi(stepTracer)
            const programmatic = engine.getStepBuilder()({
                name: 'prog-step',
                execute: vi.fn(),
            })
            const wf = engine.createWorkflow({ steps: [programmatic], onError: async () => {} })
            const conversation = engine.createConversation([])
            await wf.run(conversation, {})

            expect(stepTracer.addStepTrace).not.toHaveBeenCalled()
            expect(stepTracer.flush).toHaveBeenCalledTimes(1)
        })
    })
})

function getAi(tracer = { addStep: noop }) {
    const ai = createAIEngine({
        tracer,
        logger: { ...console, debug: noop, error: noop },
    })
    const step = ai.getStepBuilder()
    const cnv = ai.createConversation([])
    return { ai, step, cnv }
}

const noop = () => {}
const noopA = () => Promise.resolve()
async function onError(err: any) {
    console.trace(err)
    throw err
}
