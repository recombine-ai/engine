import { OpenAI } from 'openai'
import { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions'
import type { LlmAdapter } from '../ai'
import { type ZodType, toJSONSchema } from 'zod'

export type OpenAIChatOptions = Omit<ChatCompletionCreateParamsBase, 'messages' | 'stream'>

export type OpenAIAdapterAuth = {
    tokenStorage: { getToken: () => Promise<string | null> }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function createOpenAIAdapter(
    options: OpenAIChatOptions,
    auth: OpenAIAdapterAuth,
): LlmAdapter {
    return {
        getOptions: () => options,
        async generateResponse(
            systemPrompt: string,
            messages: string,
            schema?: ZodType,
        ): Promise<string> {
            const finalOptions = { ...options }
            if (schema) {
                finalOptions.response_format = {
                    type: 'json_schema',
                    json_schema: {
                        name: 'detector_response',
                        schema: toJSONSchema(schema),
                        strict: true,
                    },
                }
            }
            const apiKey = await auth.tokenStorage.getToken()
            if (!apiKey) {
                throw new Error('OpenAI API key is not set')
            }
            if (apiKey === '__TESTING__') {
                await delay(100)
                if (options.response_format && 'json_schema' in options.response_format) {
                    return JSON.stringify({ message: 'canned response', reasons: [] })
                }
                return 'canned response'
            }

            const client = new OpenAI({ apiKey })
            const response = await client.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: messages },
                ],
                ...finalOptions,
            })

            const content = response.choices[0]?.message?.content
            if (!content) {
                throw new Error('No response from OpenAI')
            }
            return content
        },
    }
}
