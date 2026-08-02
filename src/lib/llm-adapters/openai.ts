import { OpenAI } from 'openai'
import { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions'
import { type ZodType, toJSONSchema } from 'zod'
import { LlmAdapter } from '../interfaces'
import { detectProvider } from './provider'

type OpenaiOptionsToSend = Omit<ChatCompletionCreateParamsBase, 'messages' | 'stream'>
export type OpenAIChatOptions = Omit<OpenaiOptionsToSend, 'response_format'>

export function createOpenAIAdapter(options: OpenAIChatOptions, client = new OpenAI()): LlmAdapter {
    return {
        getOptions: () => options,
        getProviderInfo: () => ({ provider: detectProvider(client), model: options.model }),
        async generateResponse(
            systemPrompt: string,
            messages: string,
            schema?: ZodType,
        ): Promise<string> {
            const finalOptions: OpenaiOptionsToSend = { ...options }
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
