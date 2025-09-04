import { ZodSchema } from 'zod'
import { PromptFile } from '../prompt-fs'
import { Logger } from '../interfaces'

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

export function createConsoleTracer(logger: Logger): Tracer {
    return {
        addStep(def) {
            logger.debug('Tracer, step added:', def)
        },
    }
}

export function stdPrompt(prompt: PromptFile | string) {
    if (typeof prompt === 'string') {
        return {
            type: 'string',
            content: async () => prompt,
        } as PromptString
    }
    return prompt
}