import { ZodSchema } from 'zod'
import { PromptFile } from '../prompt-fs'
import { Logger } from '../interfaces'
import zodToJsonSchema from 'zod-to-json-schema'

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
    receivedPrompt?: string | PromptFile | File

    stringifiedConversation?: string
    schema?: ZodSchema
    model?: string

    /** Raw response from LLM or function call result */
    response?: string

    /** Timestamp in milliseconds */
    createdAt: number

    error?: Error
}

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

export function createStubStepTracer(logger: Logger) {
    return {
        addStepTrace(trace: StepTrace) {
            logger.log(`StepTrace: ${trace.name}, in workflow (${trace.workflowId})`)
            if (trace.model) {
                logger.log(`StepTrace, model: ${trace.model}`)
            }
            if (trace.schema) {
                logger.log('StepTrace, schema:', zodToJsonSchema(trace.schema))
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
