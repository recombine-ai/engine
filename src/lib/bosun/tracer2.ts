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

export interface Tracer2 {
    addStepTrace(stepTrace: StepTrace): void
}

/*
Example: create an in-memory tracer

export function createInMemoryTracer() {
    const traces: StepTrace[] = []
    return {
        addStepTrace(stepTrace: StepTrace) {
            traces.push(stepTrace)
        },
        getTraces: () => traces,
    }
}
*/