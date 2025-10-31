import { ZodSchema } from 'zod'
import { PromptFile } from '../prompt-fs'

export type StepTrace = {
    /** Unique ID for the trace */
    traceId?: string
    callId?: string

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
    createdAt?: number
}

export interface StepTracer {
    /**
     * Create step trace and add it to the tracer
     * @param name - name of the step
     * @param workflowId - ID of the workflow
     * @param traceId - ID of the trace
     * @param workflowRunId - ID of the workflow run
     */
    createStepTrace(
        step: Partial<StepTrace> & Pick<StepTrace, 'name' | 'workflowId' | 'workflowRunId'>,
    ): StepTrace

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
