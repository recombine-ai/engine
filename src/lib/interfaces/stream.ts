import { Message } from './conversation'
import { StepRegistry, StepTracer } from '../bosun'
import { PromptFile } from '../prompt-fs'
import { Logger } from './other'

export interface AIStreamEngine<CTX extends {}> {
    /** creates streaming workflow */
    createWorkflow: (config: StreamWorkflowConfig<CTX>) => {
        /**
         * Runs streaming workflow (starts stream)
         * @param messages
         * @param ctx – context to be used in prompt
         * @returns
         */
        run: (messages: Message[], ctx: CTX) => Promise<ReadableStream<ResponseChunk>>
    }
}

export interface StreamingEngineConfig {
    /**  Optional logger instance for handling log messages.  */
    logger?: Logger
    /** registers steps in workflow to be available in Bosun IDE */
    stepRegistry?: StepRegistry
    /** traces received prompt, rendered prompt, context and other useful info about LLM execution */
    stepTracer?: StepTracer
}

export interface StreamWorkflowConfig<CTX> {
    /** name of the workflow and its only step to appear in Bosun and in traces */
    name: string
    /** system prompt */
    prompt: string | PromptFile
    /** LLM model with streaming support */
    model: LlmStreamAdapter
    onError: (error: Error | string, ctx: CTX) => Promise<void>
    /** filter out some tokens on the fly */
    filter?: ProgrammaticFilter // only one filter supported for now, not sure how to implement parallel filters yet
}

export interface Transcript {
    responseChunks: ResponseChunk[]
    messages: Message[]
    readonly currentResponse: string
    readonly mainResponseFinished: boolean
    markMainResponseFinished(): void
    toString(ignoreDirectives?: boolean): string
    getConversation(): Message[]
}

export interface LlmStreamAdapter {
    /**
     * @param systemPrompt - rendered system prompt
     * @param messages - stringified {@link Conversation}
     * @returns LLM Response
     */
    generateStream: (systemPrompt: string, messages: string) => Promise<ReadableStream<string>>
    /** Returns adapter's configuration/options for tracing */
    getOptions: () => unknown
}

export interface ProgrammaticFilter {
    shouldStartFiltering: (state: Transcript, newToken: string) => boolean
    onNewToken: (
        state: Transcript,
        filteredTokens: string[],
    ) => { action: 'CONTINUE_FILTERING' } | { action: 'RELEASE_TOKENS'; tokens: string[] }
    onStreamEnd: (state: Transcript, filteredTokens: string[]) => { tokensToRelease: string[] }
}

export interface ResponseChunk {
    role: 'agent' | 'system'
    delta: string
}
