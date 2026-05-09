import type { LlmAdapter } from '../ai'

export function createMockAdapter(): LlmAdapter {
    return {
        getOptions: () => ({ model: 'mock' }),
        async generateResponse(_systemPrompt: string, _messages: string, schema?): Promise<string> {
            if (schema) {
                return JSON.stringify({ message: 'mock response' })
            }
            return 'mock response'
        },
    }
}
