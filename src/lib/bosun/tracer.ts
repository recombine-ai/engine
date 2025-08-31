import { ZodSchema } from 'zod'
import { PromptFile } from '../prompt-fs'

export interface PromptString {
    type: 'string'
    content: () => Promise<string>
}

export interface StepTraceDef {
    name: string
    type: 'streaming-response' | 'streaming-detect' | 'text'
    prompt: PromptFile | PromptString
    schema?: ZodSchema
}
export interface Tracer {
    addStep(def: StepTraceDef): void
}
