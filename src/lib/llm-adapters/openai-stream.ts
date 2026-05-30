import { OpenAI } from 'openai'
import { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions'

import { LlmStreamAdapter } from '../interfaces/stream'

export type OpenAIChatOptions = Omit<
    ChatCompletionCreateParamsBase,
    'messages' | 'response_format' | 'stream'
>

export function createOpenAIStreamAdapter(
    options: OpenAIChatOptions,
    client = new OpenAI(),
): LlmStreamAdapter {
    return {
        getOptions: () => options,
        async generateStream(
            systemPrompt: string,
            messages: string,
        ): Promise<ReadableStream<string>> {
            const stream = await client.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: messages },
                ],
                ...options,
                stream: true,
                response_format: { type: 'text' },
            })

            return new ReadableStream<string>({
                async start(controller) {
                    for await (const chunk of stream) {
                        const content = chunk.choices?.[0]?.delta?.content
                        if (content) controller.enqueue(content)
                    }
                    controller.close()
                },
            })
        },
    }
}
