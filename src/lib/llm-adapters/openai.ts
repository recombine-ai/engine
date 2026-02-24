import { AzureOpenAI, OpenAI } from 'openai'
import { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions'
import type { ChatCompletionChunk } from 'openai/resources/chat/completions'
import type { LlmAdapter } from '../ai'
import { z } from 'zod'

export type OpenAIChatOptions = Omit<ChatCompletionCreateParamsBase, 'messages' | 'stream'>

export type OpenAIAdapterAuth = {
    tokenStorage: { getToken: () => Promise<string | null> }
}

export type AzureOpenAIAdapterConfig = {
    endpoint: string
    apiVersion: string
    deployment?: string
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function createOpenAIAdapter(
    options: OpenAIChatOptions,
    auth: OpenAIAdapterAuth,
): LlmAdapter<ChatCompletionChunk> {
    return {
        getOptions: () => options,
        async generateResponse(
            systemPrompt: string,
            messages: string,
            schema?: z.ZodType,
        ): Promise<string> {
            const finalOptions = { ...options }
            if (schema) {
                finalOptions.response_format = {
                    type: 'json_schema',
                    json_schema: {
                        name: 'detector_response',
                        schema: z.toJSONSchema(schema),
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
        async streamResponse(
            systemPrompt: string,
            messages: string,
            schema?: z.ZodType,
        ): Promise<AsyncIterable<ChatCompletionChunk>> {
            // TODO: This adapter is copy-pasted from an earlier implementation; consolidate shared logic with `generateResponse`.
            const finalOptions = { ...options }
            if (schema) {
                finalOptions.response_format = {
                    type: 'json_schema',
                    json_schema: {
                        name: 'detector_response',
                        schema: z.toJSONSchema(schema),
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
                const cannedResponse = schema
                    ? JSON.stringify({ message: 'canned response', reasons: [] })
                    : 'canned response'

                return (async function* () {
                    yield {
                        id: 'chatcmpl-testing',
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: finalOptions.model,
                        choices: [
                            {
                                index: 0,
                                finish_reason: null,
                                delta: { content: cannedResponse },
                            },
                        ],
                    } satisfies ChatCompletionChunk
                })()
            }

            const client = new OpenAI({ apiKey })
            return await client.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: messages },
                ],
                ...finalOptions,
                stream: true,
            })
        },
    }
}

export function createAzureOpenAIAdapter(
    options: OpenAIChatOptions,
    azure: AzureOpenAIAdapterConfig,
    auth: OpenAIAdapterAuth,
): LlmAdapter<ChatCompletionChunk> {
    return {
        getOptions: () => ({ ...options, azure }),
        async generateResponse(
            systemPrompt: string,
            messages: string,
            schema?: z.ZodType,
        ): Promise<string> {
            const finalOptions = { ...options }
            if (schema) {
                finalOptions.response_format = {
                    type: 'json_schema',
                    json_schema: {
                        name: 'detector_response',
                        schema: z.toJSONSchema(schema),
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

            const client = new AzureOpenAI({
                apiKey,
                apiVersion: azure.apiVersion,
                endpoint: azure.endpoint,
                deployment: azure.deployment,
            })
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
        async streamResponse(
            systemPrompt: string,
            messages: string,
            schema?: z.ZodType,
        ): Promise<AsyncIterable<ChatCompletionChunk>> {
            // TODO: This adapter is copy-pasted from an earlier implementation; consolidate shared logic with `generateResponse`.
            const finalOptions = { ...options }
            if (schema) {
                finalOptions.response_format = {
                    type: 'json_schema',
                    json_schema: {
                        name: 'detector_response',
                        schema: z.toJSONSchema(schema),
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
                const cannedResponse = schema
                    ? JSON.stringify({ message: 'canned response', reasons: [] })
                    : 'canned response'

                return (async function* () {
                    yield {
                        id: 'chatcmpl-testing',
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: finalOptions.model,
                        choices: [
                            {
                                index: 0,
                                finish_reason: null,
                                delta: { content: cannedResponse },
                            },
                        ],
                    } satisfies ChatCompletionChunk
                })()
            }

            const client = new AzureOpenAI({
                apiKey,
                apiVersion: azure.apiVersion,
                endpoint: azure.endpoint,
                deployment: azure.deployment,
            })
            return await client.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: messages },
                ],
                ...finalOptions,
                stream: true,
            })
        },
    }
}
