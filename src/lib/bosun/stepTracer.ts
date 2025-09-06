import { ZodSchema } from 'zod'
import { Logger } from '../interfaces'

export type StepTrace = {
    name: string,
    renderedPrompt?: string,
    receivedContext?: Record<string, unknown>
    receivedPrompt?: string | File
    stringifiedConversation?: string
    schema?: ZodSchema
    model?: string
}

export interface StepTracer {
    addStepTrace(stepTrace: StepTrace): void
}