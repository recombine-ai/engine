import * as Zod from 'zod'

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
}
