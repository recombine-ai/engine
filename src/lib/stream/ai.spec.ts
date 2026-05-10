import { describe, it, expect, vi } from 'vitest'
import { createAIStreamEngine } from './ai'
import { LlmStreamAdapter, ProgrammaticFilter, StreamingEngineConfig } from './interfaces'

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
    })

    describe('custom ProgrammaticFilter', () => {
        it('filters tokens using a custom filter that removes a keyword', async () => {
            const customFilter: ProgrammaticFilter = {
                shouldStartFiltering(_state, newToken) {
                    return newToken === '[THINK]'
                },
                onNewToken(_state, filteredTokens) {
                    const last = filteredTokens[filteredTokens.length - 1]
                    if (last === '[/THINK]') {
                        // Drop everything between [THINK] and [/THINK]
                        return { action: 'RELEASE_TOKENS', tokens: [] }
                    }
                    return { action: 'CONTINUE_FILTERING' }
                },
                onStreamEnd(_state, filteredTokens) {
                    // If stream ends mid-filter, release nothing
                    return { tokensToRelease: [] }
                },
            }

            const engine = createAIStreamEngine(makeConfig())
            const workflow = engine.createWorkflow({
                name: 'test',
                prompt: 'prompt',
                model: createMockModel([
                    'Hello',
                    ' ',
                    '[THINK]',
                    'internal',
                    ' reasoning',
                    '[/THINK]',
                    ' World',
                ]),
                filter: customFilter,
                onError: noopError,
            })

            const stream = await workflow.run([{ sender: 'user', text: 'Hi' }], {})
            const chunks = await collectChunks(stream)
            expect(textOf(chunks)).toBe('Hello  World')
        })

        it('releases filtered tokens when stream ends without closing marker', async () => {
            const customFilter: ProgrammaticFilter = {
                shouldStartFiltering(_state, newToken) {
                    return newToken === '<'
                },
                onNewToken(_state, filteredTokens) {
                    const last = filteredTokens[filteredTokens.length - 1]
                    if (last === '>') {
                        return { action: 'RELEASE_TOKENS', tokens: filteredTokens }
                    }
                    return { action: 'CONTINUE_FILTERING' }
                },
                onStreamEnd(_state, filteredTokens) {
                    return { tokensToRelease: filteredTokens }
                },
            }

            const engine = createAIStreamEngine(makeConfig())
            const workflow = engine.createWorkflow({
                name: 'test',
                prompt: 'prompt',
                model: createMockModel(['Hi', ' ', '<', 'unclosed']),
                filter: customFilter,
                onError: noopError,
            })

            const stream = await workflow.run([{ sender: 'user', text: 'Hi' }], {})
            const chunks = await collectChunks(stream)
            expect(textOf(chunks)).toBe('Hi <unclosed')
        })

        it('filter receives correct transcript state', async () => {
            const shouldStartSpy = vi.fn().mockReturnValue(false)
            const customFilter: ProgrammaticFilter = {
                shouldStartFiltering: shouldStartSpy,
                onNewToken: vi.fn(() => ({ action: 'RELEASE_TOKENS' as const, tokens: [] })),
                onStreamEnd: vi.fn(() => ({ tokensToRelease: [] })),
            }

            const engine = createAIStreamEngine(makeConfig())
            const workflow = engine.createWorkflow({
                name: 'test',
                prompt: 'prompt',
                model: createMockModel(['token1', 'token2']),
                filter: customFilter,
                onError: noopError,
            })

            await collectChunks(await workflow.run([{ sender: 'user', text: 'Hello' }], {}))

            // shouldStartFiltering is called for every token
            expect(shouldStartSpy).toHaveBeenCalledTimes(2)
            // First call: transcript with empty response so far
            const firstTranscript = shouldStartSpy.mock.calls[0][0]
            expect(firstTranscript.messages).toEqual([{ sender: 'user', text: 'Hello' }])
        })

        it('applies defaultFilter when filter is undefined', async () => {
            const engine = createAIStreamEngine(makeConfig())
            const workflow = engine.createWorkflow({
                name: 'test',
                prompt: 'prompt',
                model: createMockModel(['agent', ':', ' Hi']),
                filter: undefined,
                onError: noopError,
            })

            const stream = await workflow.run([{ sender: 'user', text: 'Hi' }], {})
            const chunks = await collectChunks(stream)
            // destructuring default kicks in, so defaultFilter strips "Agent:"
            expect(textOf(chunks)).toBe(' Hi')
        })
    })

    describe('filter with multiple filter activations', () => {
        it('applies filter multiple times in a single stream', async () => {
            const customFilter: ProgrammaticFilter = {
                shouldStartFiltering(_state, newToken) {
                    return newToken === '**'
                },
                onNewToken(_state, filteredTokens) {
                    const last = filteredTokens[filteredTokens.length - 1]
                    if (last === '**' && filteredTokens.length > 1) {
                        // Strip the bold markers, keep inner content
                        const inner = filteredTokens.slice(1, -1)
                        return { action: 'RELEASE_TOKENS', tokens: inner }
                    }
                    return { action: 'CONTINUE_FILTERING' }
                },
                onStreamEnd(_state, filteredTokens) {
                    return { tokensToRelease: filteredTokens }
                },
            }

            const engine = createAIStreamEngine(makeConfig())
            const workflow = engine.createWorkflow({
                name: 'test',
                prompt: 'prompt',
                model: createMockModel(['Say ', '**', 'hello', '**', ' and ', '**', 'bye', '**']),
                filter: customFilter,
                onError: noopError,
            })

            const stream = await workflow.run([{ sender: 'user', text: 'Hi' }], {})
            const chunks = await collectChunks(stream)
            expect(textOf(chunks)).toBe('Say hello and bye')
        })
    })
})
