import { ZodSchema } from 'zod'
import { PromptFile } from '../prompt-fs'

export type StepTrace = {
    name: string
    renderedPrompt?: string
    receivedContext?: Record<string, unknown>
    receivedPrompt?: string | PromptFile
    stringifiedConversation?: string
    schema?: ZodSchema
    model?: string
}

export interface StepTracer {
    addStepTrace(stepTrace: StepTrace): void
}
