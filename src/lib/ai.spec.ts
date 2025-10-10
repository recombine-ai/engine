import { describe, it, expect, vi, Mock } from 'vitest'
import { AIEngine, createAIEngine } from './ai'
import { PromptFile } from './prompt-fs'
import { z } from 'zod'

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
        const ai = createAIEngine({
            tracer: { addStep: (s) => void 0 },
            logger: {...console, debug: noop},
            tokenStorage: { getToken: () => Promise.resolve('__TESTING__') },
        })
        const step = ai.getStepBuilder()
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
            execute: vi.fn()
        })
        const wf = ai.createWorkflow({
            steps: [dumbStep],
            onError: async (err) => console.error(err),
        })
        wf.addStep(mainStep)
        wf.addStep(smartStep)

        const cnv = ai.createConversation([])
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
    it('terminates the workflow', async() => {});
    it.skip('rewinds up to maxAttempts', async () => {})
    it.skip('response parsing for smart steps', async () => {})
    describe.skip('tracer', () => {
        it('adds all steps', async () => {})
    })
})

const noop = () => {}
const noopA = () => Promise.resolve()
