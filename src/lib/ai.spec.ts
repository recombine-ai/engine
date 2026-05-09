import { describe, it, expect, vi, Mock } from 'vitest'
import { createAIEngine } from './ai'
import { PromptFile } from './prompt-fs'
import { z } from 'zod'
import { createOpenAIAdapter } from './llm-adapters/openai'
import { createMockAdapter } from './llm-adapters/mock'

// TODO: clean-up stdout by providing noop-stepTracer in all tests which don't have its own

// Mock OpenAI at the top level
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

function makeStepTracer() {
    return {
        addStepTrace: vi.fn(),
        flush: vi.fn(() => Promise.resolve()),
    }
}

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

        conversation.addMessage({ sender: 'user', text: 'I need help with my account' })
        conversation.addMessage({ sender: 'system', text: 'Ask for account details' })
        conversation.setProposedReply('Please provide your account number')

        const outputIgnoringAdded = conversation.toString({ ignoreAddedMessages: true })
        const expectedIgnoring = [
            'User: Hello, I need help with my order.',
            'Agent: Sure, I can help you with that.',
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

        conversation.addMessage({ sender: 'user', text: 'I need help with my account' })
        conversation.addMessage({ sender: 'system', text: 'Ask for account details' })
        conversation.setProposedReply('Please provide your account number')

        const outputFull = conversation.toString()
        const expectedFull = [
            'User: Hello, I need help with my order.',
            'Agent: Sure, I can help you with that.',
            'User: I need help with my account',
            'System: Ask for account details',
            'Proposed reply: Please provide your account number',
        ].join('\n')
        expect(outputFull).toBe(expectedFull)
    })
})

describe('workflow.run', () => {
    it('runs all steps', async () => {
        const { ai, step, cnv } = getAi()
        const mockAdapter = createMockAdapter()

        const dumbStep = step({
            name: 'dumb-step',
            runIf: vi.fn(() => true),
            execute: vi.fn(),
        })
        const mainPrompt = { content: vi.fn(() => 'hello') } as any as PromptFile
        const mainStep = step({
            name: 'main',
            prompt: mainPrompt,
            model: mockAdapter,
            execute: vi.fn(),
        })
        const smartStep = step({
            name: 'smart-step',
            runIf: vi.fn(() => true),
            schema: z.object({}),
            prompt: { content: vi.fn(() => 'hello') } as any as PromptFile,
            model: mockAdapter,
            execute: vi.fn(),
        })
        const wf = ai.createWorkflow({
            steps: [dumbStep, mainStep, smartStep],
            onError,
        })

        const ctx = {}
        const wfHandle = expect.objectContaining({
            terminate: expect.any(Function),
            rewindTo: expect.any(Function),
        })
        await wf.run(cnv, () => ctx)
        expect(dumbStep.runIf).toBeCalledWith(cnv, ctx)
        expect(dumbStep.execute).toBeCalledWith(cnv, ctx, wfHandle)
        expect(mainPrompt.content).toBeCalled()
        expect(mainStep.execute).toBeCalledWith(expect.any(String), cnv, ctx, wfHandle)
        expect(smartStep.runIf).toBeCalled()
        expect(smartStep.execute).toBeCalledWith(expect.any(Object), cnv, ctx, wfHandle)
    })

    it('executes smart steps with parsed response', async () => {
        const ai = createAIEngine({
            logger: { ...console, debug: noop, error: noop },
        })
        const step = ai.getStepBuilder()
        const cnv = ai.createConversation([])

        const testSchema = z.object({
            name: z.string(),
            age: z.number(),
        })

        const mockAdapter = {
            getOptions: () => ({}),
            generateResponse: async () => JSON.stringify({ name: 'John', age: 30 }),
        }

        const smartStep = step({
            name: 'smart-step',
            schema: testSchema,
            prompt: 'Get user info',
            model: mockAdapter,
            execute: vi.fn(),
        })

        const wf = ai.createWorkflow({
            steps: [smartStep],
            onError,
        })

        await wf.run(cnv, emptyContextProvider)

        expect(smartStep.execute).toBeCalledWith(
            { name: 'John', age: 30 },
            cnv,
            {},
            expect.any(Object),
        )
    })

    it('executes smart step with erroneous execution and error in onError', async () => {
        const ai = createAIEngine({
            logger: { ...console, debug: noop, error: noop },
        })
        const step = ai.getStepBuilder()
        const cnv = ai.createConversation([])

        const mockAdapter = {
            getOptions: () => ({}),
            generateResponse: async () => 'ok',
        }

        const smartStep = step({
            name: 'smart-step',
            prompt: 'Get user info',
            model: mockAdapter,
            execute: vi.fn(async () => {
                throw new Error('Execution failed')
            }),
        })

        const onError = vi.fn().mockImplementation(() => {})
        const wf = ai.createWorkflow({
            steps: [smartStep],
            onError,
        })

        await wf.run(cnv, emptyContextProvider)

        expect(smartStep.execute).toBeCalled()
        expect(onError).toHaveBeenCalled()
    })

    it('executes smart steps with corrupted JSON parsed response', async () => {
        const ai = createAIEngine({
            logger: { ...console, debug: noop, error: noop },
        })
        const step = ai.getStepBuilder()
        const cnv = ai.createConversation([])

        const testSchema = z.object({
            name: z.string(),
            age: z.number(),
        })

        const mockAdapter = {
            getOptions: () => ({}),
            generateResponse: async () => '{"name": "John", age: "30}', // Corrupted JSON with an extra quote
        }

        const smartStep = step({
            name: 'smart-step',
            schema: testSchema,
            prompt: 'Get user info',
            model: mockAdapter,
            execute: vi.fn(),
        })

        const mockOnError = vi.fn().mockResolvedValue(undefined)
        const wf = ai.createWorkflow({
            steps: [smartStep],
            onError: mockOnError,
        })

        await wf.run(cnv, emptyContextProvider)

        expect(smartStep.execute).not.toHaveBeenCalled()
        expect(mockOnError).toHaveBeenCalledOnce()
        expect(mockOnError).toHaveBeenCalledWith(
            expect.stringContaining(`Response is not valid JSON for step ${step.name}`),
            expect.anything(),
        )
    })

    it('executes smart steps with a violated JSON response for the Zod schema', async () => {
        const ai = createAIEngine({
            logger: { ...console, debug: noop, error: noop },
        })
        const step = ai.getStepBuilder()
        const cnv = ai.createConversation([])

        const testSchema = z.object({
            name: z.string(),
            age: z.number(),
            isMarried: z.boolean(),
        })

        const mockAdapter = {
            getOptions: () => ({}),
            generateResponse: async () =>
                JSON.stringify({ name: 'John', age: 30, isMarried: 'no' }),
        }

        const smartStep = step({
            name: 'smart-step',
            schema: testSchema,
            prompt: 'Get user info',
            model: mockAdapter,
            execute: vi.fn(),
        })

        const mockOnError = vi.fn().mockResolvedValue(undefined)
        const wf = ai.createWorkflow({
            steps: [smartStep],
            onError: mockOnError,
        })

        await wf.run(cnv, emptyContextProvider)

        expect(smartStep.execute).not.toHaveBeenCalled()
        expect(mockOnError).toHaveBeenCalledOnce()
        expect(mockOnError).toHaveBeenCalledWith(
            expect.stringContaining(`Response validation failed for step ${step.name}`),
            expect.anything(),
        )
    })

    it('passes explicit adapter options to OpenAI', async () => {
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
            tokenStorage: { getToken: () => Promise.resolve('mocked') },
        })
        const s = step({ name: 's', prompt: 'P', model: llm, execute: vi.fn() })
        const wf = ai.createWorkflow({ steps: [s], onError })
        await wf.run(cnv, emptyContextProvider)

        expect(createMock).toBeCalledWith(
            expect.objectContaining({
                temperature: 0.55,
                user: 'tester',
                max_tokens: 11,
                model: 'gpt-4o-2024-08-06',
            }),
        )
    })

    it('adds adapter options to step trace model as JSON string', async () => {
        const stepTracer = makeStepTracer()
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
        await wf.run(cnv, emptyContextProvider)

        expect(stepTracer.addStepTrace).toBeCalled()
        const firstCallArg = (stepTracer.addStepTrace as Mock).mock.calls[0][0]
        expect(firstCallArg.model).toBe(JSON.stringify(options))
    })

    describe('workflow handle', () => {
        it('terminates the workflow', async () => {
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
            await wf.run(cnv, emptyContextProvider)

            expect(secondStep.execute).not.toHaveBeenCalled()
        })
        it('rewinds to the specified step', async () => {
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

            await wf.run(cnv, emptyContextProvider)

            expect(firstStep.execute).toBeCalledTimes(2)
        })
        it('rewinds up to maxAttempts', async () => {
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

            await wf.run(cnv, emptyContextProvider)

            expect(firstStep.execute).toBeCalledTimes(3)
            expect(mockOnError).toHaveBeenCalledOnce()
        })
        it('resets the counter when passed to the next step', async () => {
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

            await wf.run(cnv, emptyContextProvider)

            expect(firstStep.execute).toBeCalledTimes(5)
            expect(mockOnError).toHaveBeenCalledOnce()
        })
    })

    describe('tracer', () => {
        it('adds all steps', async () => {
            const tracer = { addStep: vi.fn() }
            const { ai, step } = getAi(tracer)
            const mockAdapter = createMockAdapter()

            const firstStep = step({
                name: 'first-step',
                prompt: '',
                model: mockAdapter,
                runIf: () => true,
                execute: vi.fn(),
            })

            const secondStep = step({
                name: 'second-step',
                prompt: '',
                model: mockAdapter,
                runIf: () => true,
                execute: vi.fn(),
            })

            const thirdStep = step({
                name: 'third-step',
                prompt: '',
                model: mockAdapter,
                runIf: () => true,
                execute: vi.fn(),
            })

            ai.createWorkflow({
                steps: [firstStep, secondStep, thirdStep],
                onError: noopA,
            })

            expect(tracer.addStep).toBeCalledTimes(3)
        })
    })

    describe('stepTracer integration', () => {
        const mockAdapter = createMockAdapter()
        function makeAi(stepTracer: ReturnType<typeof makeStepTracer>) {
            return createAIEngine({
                logger: { ...console, debug: vi.fn(), error: vi.fn() },
                stepTracer,
            })
        }
        it('records a basic string LLM step trace before execution and flushes after run', async () => {
            const stepTracer = makeStepTracer()
            const engine = makeAi(stepTracer)
            const step = engine.getStepBuilder()({
                name: 'hello-step',
                prompt: 'Say hello',
                model: mockAdapter,
                execute: vi.fn(),
            })
            const wf = engine.createWorkflow({
                steps: [step],
                onError: async () => {},
                name: 'wf-1',
            })
            const conversation = engine.createConversation([])
            await wf.run(conversation, () => ({ foo: 'bar' }))

            expect(stepTracer.addStepTrace).toHaveBeenCalledTimes(1)
            const trace = stepTracer.addStepTrace.mock.calls[0][0]
            expect(trace.name).toBe('hello-step')
            expect(trace.workflowId).toBe('wf-1')
            expect(trace.workflowRunId).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
            )
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
                model: mockAdapter,
                execute: vi.fn(),
            })
            const wf = engine.createWorkflow({ steps: [jsonStep], onError: async () => {} })
            const conversation = engine.createConversation([])
            await wf.run(conversation, emptyContextProvider)

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
        it('records a single trace on error path and terminates', async () => {
            const stepTracer = makeStepTracer()
            const engine = makeAi(stepTracer)
            const failingStep = engine.getStepBuilder()({
                name: 'fail-step',
                prompt: 'Cause an error',
                model: mockAdapter,
                execute: vi.fn(() => {
                    throw new Error('boom')
                }),
                onError: vi.fn(),
            })
            const wf = engine.createWorkflow({ steps: [failingStep], onError: async () => {} })
            const conversation = engine.createConversation([])
            const result = await wf.run(conversation, emptyContextProvider)

            expect(stepTracer.addStepTrace).toHaveBeenCalledTimes(1)
            const trace = stepTracer.addStepTrace.mock.calls[0][0]
            expect(trace.name).toBe('fail-step')
            expect(trace.error).toBeInstanceOf(Error)
            expect(trace.error?.message).toBe('boom')
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
            await wf.run(conversation, emptyContextProvider)

            expect(stepTracer.addStepTrace).not.toHaveBeenCalled()
            expect(stepTracer.flush).toHaveBeenCalledTimes(1)
        })
    })

    describe('before/afterExecute hooks', () => {
        describe('beforeExecute hook', () => {
            it('runs before execute', async () => {
                const { ai, step, cnv } = getAi()
                const beforeExecute = vi.fn()
                const wf = ai.createWorkflow({
                    onError,
                    beforeExecute,
                    steps: [step({ name: 'first-step', runIf: () => true, execute: noopA })],
                })
                const context = { foo: 'bar' }
                await wf.run(cnv, () => context)

                expect(beforeExecute).toBeCalledTimes(1)
                expect(beforeExecute).toBeCalledWith(context)
            })
            it('does NOT run if no execution', async () => {
                const { ai, step, cnv } = getAi()
                const beforeExecute = vi.fn()
                const wf = ai.createWorkflow({
                    onError,
                    beforeExecute,
                    steps: [step({ name: 'first-step', runIf: () => false, execute: noopA })],
                })
                await wf.run(cnv, () => ({}))

                expect(beforeExecute).toBeCalledTimes(0)
            })
            it('runs before execute exactly once', async () => {
                const { ai, step, cnv } = getAi()
                const beforeExecute = vi.fn()
                const wf = ai.createWorkflow({
                    onError,
                    beforeExecute,
                    steps: [
                        step({ name: 'first-step', runIf: () => true, execute: noopA }),
                        step({ name: 'second-step', runIf: () => true, execute: noopA }),
                    ],
                })
                const context = { foo: 'bar' }
                await wf.run(cnv, () => context)

                expect(beforeExecute).toBeCalledTimes(1)
            })

            it('runs before all steps', async () => {
                const { ai, step, cnv } = getAi()
                const beforeExecute = vi.fn()
                const firstExecute = vi.fn()
                const secondExecute = vi.fn()
                const wf = ai.createWorkflow({
                    onError,
                    beforeExecute,
                    steps: [
                        step({ name: 'first-step', runIf: () => true, execute: firstExecute }),
                        step({ name: 'second-step', runIf: () => true, execute: secondExecute }),
                    ],
                })
                const context = { foo: 'bar' }
                await wf.run(cnv, () => context)

                const firstOrder = firstExecute.mock.invocationCallOrder[0]
                const secondOrder = secondExecute.mock.invocationCallOrder[0]
                const afterOrder = beforeExecute.mock.invocationCallOrder[0]
                expect(afterOrder).toBeLessThan(firstOrder)
                expect(afterOrder).toBeLessThan(secondOrder)
            })
        })
        describe('afterExecute hook', () => {
            it('runs before execute', async () => {
                const { ai, step, cnv } = getAi()
                const afterExecute = vi.fn()
                const wf = ai.createWorkflow({
                    onError,
                    afterExecute,
                    steps: [step({ name: 'first-step', runIf: () => true, execute: noopA })],
                })
                const context = { foo: 'bar' }
                await wf.run(cnv, () => context)

                expect(afterExecute).toBeCalledTimes(1)
                expect(afterExecute).toBeCalledWith(context)
            })
            it('does NOT run if no execution', async () => {
                const { ai, step, cnv } = getAi()
                const afterExecute = vi.fn()
                const wf = ai.createWorkflow({
                    onError,
                    afterExecute,
                    steps: [step({ name: 'first-step', runIf: () => false, execute: noopA })],
                })
                await wf.run(cnv, () => ({}))

                expect(afterExecute).toBeCalledTimes(0)
            })
            it('runs after execute exactly once', async () => {
                const { ai, step, cnv } = getAi()
                const afterExecute = vi.fn()
                const wf = ai.createWorkflow({
                    onError,
                    afterExecute,
                    steps: [
                        step({ name: 'first-step', runIf: () => true, execute: noopA }),
                        step({ name: 'second-step', runIf: () => true, execute: noopA }),
                    ],
                })
                const context = { foo: 'bar' }
                await wf.run(cnv, () => context)

                expect(afterExecute).toBeCalledTimes(1)
            })

            it('runs after all steps', async () => {
                const { ai, step, cnv } = getAi()
                const afterExecute = vi.fn()
                const firstExecute = vi.fn()
                const secondExecute = vi.fn()
                const wf = ai.createWorkflow({
                    onError,
                    afterExecute,
                    steps: [
                        step({ name: 'first-step', runIf: () => true, execute: firstExecute }),
                        step({ name: 'second-step', runIf: () => true, execute: secondExecute }),
                    ],
                })
                const context = { foo: 'bar' }
                await wf.run(cnv, () => context)

                const firstOrder = firstExecute.mock.invocationCallOrder[0]
                const secondOrder = secondExecute.mock.invocationCallOrder[0]
                const afterOrder = afterExecute.mock.invocationCallOrder[0]
                expect(afterOrder).toBeGreaterThan(firstOrder)
                expect(afterOrder).toBeGreaterThan(secondOrder)
            })

            it('runs even if execute throws', async () => {
                const { ai, step, cnv } = getAi()
                const afterExecute = vi.fn()
                const wf = ai.createWorkflow({
                    onError: noopA,
                    afterExecute,
                    steps: [
                        step({
                            name: 'first-step',
                            runIf: () => true,
                            execute: () => {
                                throw new Error('BOO!')
                            },
                        }),
                    ],
                })
                const context = { foo: 'bar' }
                await wf.run(cnv, () => context)

                expect(afterExecute).toBeCalledTimes(1)
            })
        })
    })
})

function getAi(stepRegistry = { addStep: noop }) {
    const ai = createAIEngine({
        stepRegistry,
        stepTracer: { addStepTrace: noop, flush: noopA },
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
const emptyContextProvider = () => ({})
