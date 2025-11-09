import { OpenAI } from 'openai'
import { sleep } from 'openai/core'
import { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions'
import type { ZodSchema } from 'zod'
import type { LlmAdapter } from '../ai'

export type OpenAIChatOptions = Omit<ChatCompletionCreateParamsBase, 'messages' | 'stream'>

function getApiKey(): string {
    if (process.env.OPENAI_API_KEY) {
        return process.env.OPENAI_API_KEY
    }
    throw new Error('OpenAI API key is not set')
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function createOpenAIAdapter(options: OpenAIChatOptions): LlmAdapter {
    return {
        getOptions: () => options,
        async generateResponse(
            systemPrompt: string,
            messages: string,
            _schema?: ZodSchema,
        ): Promise<string> {
            const apiKey = getApiKey()
            if (apiKey === '__TESTING__') {
                await sleep(100)
                if (!_schema) {
                    return 'canned response'
                }
                return JSON.stringify({ message: 'canned response', reasons: [] })
            }

            const client = new OpenAI({ apiKey })
            const response = await client.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: messages },
                ],
                ...options,
            })

            const content = response.choices[0]?.message?.content
            if (!content) {
                throw new Error('No response from OpenAI')
            }
            return content
        },
    }
}
