import { type ZodType } from 'zod'
import { PromptFile } from '../prompt-fs'
import { Logger } from '../interfaces'

export interface PromptString {
    type: 'string'
    content: () => Promise<string>
}

export interface StepDef {
    name: string
    type: 'streaming-response' | 'streaming-detect' | 'text'
    prompt: PromptFile | PromptString
    schema?: ZodType
}

/**
 * @deprecated use `StepDef` instead
 */
export type StepTraceDef = StepDef

export interface StepRegistry {
    addStep(def: StepDef): void
}

/**
 * @deprecated use `createStubRegistry` instead
 */
export const createConsoleTracer = createStubRegistry

/**
 * a stub registry, that just prints step in logs
 */
export function createStubRegistry(logger: Logger): StepRegistry {
    return {
        addStep(def) {
            logger.debug('Step registry, step added:', def)
        },
    } as StepRegistry
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
