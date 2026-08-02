import type { MonitoringProvider } from '@recombine-ai/telescope'
import * as Zod from 'zod'

/**
 * Identifies the provider behind an adapter so that provider failures (expired key, exhausted
 * quota) can be attributed to the right account. Azure and OpenAI are separate providers here even
 * though they share an SDK — their keys expire independently and are fixed by different people.
 */
export interface LlmProviderInfo {
    provider: MonitoringProvider
    /**
     * The model the adapter is configured to call. On Azure this is the deployment name, so
     * `provider` plus `model` identifies the resource — and therefore the key — behind a failure.
     */
    model?: string
}

export interface LlmAdapter {
    /**
     * @param systemPrompt - rendered system prompt
     * @param messages - stringified {@link Conversation}
     * @param schema - optional Zod schema to pass to the model. Will overwrite any schema set in adapter options.
     * @returns LLM Response
     */
    generateResponse: (
        systemPrompt: string,
        messages: string,
        schema?: Zod.ZodType,
    ) => Promise<string>
    /** Returns adapter's configuration/options for tracing */
    getOptions: () => unknown
    /**
     * Identifies the provider, so auth/quota failures can name it. Optional: adapters written
     * before this existed keep working, their failures are just reported as provider `unknown`.
     */
    getProviderInfo?: () => LlmProviderInfo
}
