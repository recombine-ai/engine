import { type ZodType, toJSONSchema } from 'zod'
import { Logger } from '../interfaces'

/**
 * @deprecated Use the analog from @recombine-ai/telescope instead.
 */
export type LlmUsage = {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
    cachedPromptTokens?: number
}

/**
 * @deprecated Use the analog from @recombine-ai/telescope instead.
 */
export type StepTrace = {
    /** Unique ID for the trace */
    traceId?: string
    conversationId?: string

    /** Optional, to group traces within a broader context */
    scopeId?: string

    /** Just unique name */
    workflowId: string
    /** Unique ID for the workflow run */
    workflowRunId: string

    name: string

    renderedPrompt?: string
    receivedContext?: Record<string, unknown> | unknown
    receivedPrompt?: string

    stringifiedConversation?: string
    schema?: ZodType
    model?: string
    llmUsage?: LlmUsage

    /** Raw response from LLM or function call result */
    response?: string

    /** Timestamp in milliseconds */
    createdAt: number

    error?: Error
}

/**
 * @deprecated Use the analog from @recombine-ai/telescope instead.
 */
export interface StepTracer {
    /**
     * Add a step trace
     * @param trace The step trace to add
     */
    addStepTrace(trace: StepTrace): void

    /**
     * Flush any buffered traces to storage
     */
    flush(): Promise<void>
}

/**
 * @deprecated Use the analog from @recombine-ai/telescope instead.
 */
export function createStubStepTracer(logger: Logger) {
    return {
        addStepTrace(trace: StepTrace) {
            logger.log(`StepTrace: ${trace.name}, in workflow (${trace.workflowId})`)
            if (trace.model) {
                logger.log(`StepTrace, model: ${trace.model}`)
            }
            if (trace.schema) {
                logger.log('StepTrace, schema:', toJSONSchema(trace.schema))
            }
            if (trace.receivedContext) {
                logger.log('StepTrace, context:', trace.receivedContext)
            }
            if (trace.stringifiedConversation) {
                logger.log(`StepTrace, messages: \n${trace.stringifiedConversation}`)
            }
            if (trace.renderedPrompt) {
                logger.log(
                    '------------ RENDERED PROMPT ----------\n' +
                        trace.renderedPrompt +
                        '\n---------------------------------------',
                )
            }
            if (trace.response) {
                logger.log(`StepTrace, LLM response:\n${trace.response}`)
            }
        },
        async flush() {},
    } satisfies StepTracer
}
