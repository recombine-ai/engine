import { describe, it, expect, vi } from 'vitest'
import { createAIStreamEngine } from './engine'
import { LlmStreamAdapter, StreamingEngineConfig } from '../interfaces/'

function createMockLogger() {
    return {
        log: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
    }
}

function createMockStepRegistry() {
    return { addStep: vi.fn() }
}

function createMockModel(tokens: string[]): LlmStreamAdapter {
    return {
        getOptions: () => ({ model: 'mock-stream' }),
        async generateStream() {
            return new ReadableStream<string>({
                start(controller) {
                    for (const token of tokens) {
                        controller.enqueue(token)
                    }
                    controller.close()
                },
            })
        },
    }
}

function makeConfig(overrides?: Partial<StreamingEngineConfig>): StreamingEngineConfig {
    return {
        logger: createMockLogger(),
        stepRegistry: createMockStepRegistry(),
        ...overrides,
    }
}

async function collectChunks(stream: ReadableStream<{ role: string; delta: string }>) {
    const chunks: { role: string; delta: string }[] = []
    for await (const chunk of stream) {
        chunks.push(chunk)
    }
    return chunks
}

function textOf(chunks: { delta: string }[]) {
    return chunks.map((c) => c.delta).join('')
}

const noopError = vi.fn(async () => {})

describe('streaming engine filters', () => {
    describe('defaultFilter (no custom filter)', () => {
        it('strips "Agent:" prefix from the beginning of a response', async () => {
            const engine = createAIStreamEngine(makeConfig())
            const workflow = engine.createWorkflow({
                name: 'test',
                prompt: 'You are a helpful agent',
                model: createMockModel(['agent', ':', ' Hello!']),
                onError: noopError,
                // uses defaultFilter by default
            })

            const stream = await workflow.run([{ sender: 'user', text: 'Hi' }], {})
            const chunks = await collectChunks(stream)
            expect(textOf(chunks)).toBe(' Hello!')
        })

        it('strips "Agent:" with any number of subtokens', async () => {
            const engine = createAIStreamEngine(makeConfig())
            const workflow = engine.createWorkflow({
                name: 'test',
                prompt: 'You are a helpful agent',
                model: createMockModel(['a', 'g', 'en', 't', ':', ' Hello!']),
                onError: noopError,
                // uses defaultFilter by default
            })

            const stream = await workflow.run([{ sender: 'user', text: 'Hi' }], {})
            const chunks = await collectChunks(stream)
            expect(textOf(chunks)).toBe(' Hello!')
        })

        it('does not strip "Agent" when not followed by colon', async () => {
            const engine = createAIStreamEngine(makeConfig())
            const workflow = engine.createWorkflow({
                name: 'test',
                prompt: 'You are a helpful agent',
                model: createMockModel(['agent', ' ', 'here']),
                onError: noopError,
            })

            const stream = await workflow.run([{ sender: 'user', text: 'Hi' }], {})
            const chunks = await collectChunks(stream)
            expect(textOf(chunks)).toBe('agent here')
        })

        it('passes through response that does not start with "Agent"', async () => {
            const engine = createAIStreamEngine(makeConfig())
            const workflow = engine.createWorkflow({
                name: 'test',
                prompt: 'prompt',
                model: createMockModel(['Hello', ' there']),
                onError: noopError,
            })

            const stream = await workflow.run([{ sender: 'user', text: 'Hi' }], {})
            const chunks = await collectChunks(stream)
            expect(textOf(chunks)).toBe('Hello there')
        })

        it('releases full string if collected tokens are shorter then "Agent:"', async () => {
            const engine = createAIStreamEngine(makeConfig())
            const workflow = engine.createWorkflow({
                name: 'test',
                prompt: 'You are a helpful agent',
                model: createMockModel(['a', 'g', 'e']),
                onError: noopError,
            })

            const stream = await workflow.run([{ sender: 'user', text: 'Hi' }], {})
            const chunks = await collectChunks(stream)
            expect(textOf(chunks)).toBe('age')
        })
    })
})
