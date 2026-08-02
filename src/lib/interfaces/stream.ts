import type { EventTracer } from '@recombine-ai/telescope'
import { Environment } from 'nunjucks'
import { Message } from './conversation'
import { StepRegistry, StepTracer } from '../bosun'
import { PromptFile } from '../prompt-fs'
import { LlmProviderInfo } from './adapter'
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
    /**
     * Emits monitoring events (provider auth/quota failures) for alerting. Without one those
     * failures are still logged and still thrown, they just do not raise an alarm.
     */
    eventTracer?: EventTracer
    /** Optional nunjucks Environment to customize prompt rendering.  */
    nunjucksEnv?: Environment
}

export interface StreamWorkflowConfig<CTX> {
    /** name of the workflow and its only step to appear in Bosun and in traces */
    name: string
    /** system prompt */
    prompt: string | PromptFile
    /** LLM model with streaming support */
    model: LlmStreamAdapter
    onError: (error: Error | string, ctx: CTX) => Promise<void>
    /** transform LLM-tokens on the fly */
    tokenTransformers?: (() => TransformStream<string, string>)[]
}

export interface Transcript {
    responseChunks: ResponseChunk[]
    messages: Message[]
    readonly currentResponse: string
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
    /**
     * Identifies the provider, so auth/quota failures can name it. Optional: adapters written
     * before this existed keep working, their failures are just reported as provider `unknown`.
     */
    getProviderInfo?: () => LlmProviderInfo
}

export interface ResponseChunk {
    role: 'agent' | 'system'
    delta: string
}
