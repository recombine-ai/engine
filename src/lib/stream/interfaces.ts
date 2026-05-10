import { Message } from '../ai'
import { Logger } from '../interfaces'
import { ConversationalTracer, StepRegistry, StepTracer } from '../bosun'
import { PromptFile } from '../prompt-fs'

export interface AIStreamEngine {
    createWorkflow: <CTX extends {}>(
        config: WorkflowConfig<CTX>,
    ) => {
        run: (messages: Message[], ctx: CTX) => Promise<ReadableStream<ResponseChunk>>
    }
}

export interface StreamingEngineConfig {
    logger: Logger
    stepRegistry: StepRegistry
    stepTracer?: StepTracer
    conversationalTracer?: ConversationalTracer
    onQuotaExceeded?: (error: Error) => Promise<void>
}

export interface WorkflowConfig<CTX> {
    name: string
    prompt: string | PromptFile
    model: LlmStreamAdapter
    onError: (error: Error | string, ctx: CTX) => Promise<void>
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
