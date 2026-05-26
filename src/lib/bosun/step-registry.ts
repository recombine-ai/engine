import { type ZodType } from 'zod'
import { PromptFile } from '../prompt-fs'
import { Logger } from '../interfaces'

/**
 * @deprecated Use the analog from @recombine-ai/bosun-lib instead.
 */
export interface PromptString {
    type: 'string'
    content: () => Promise<string>
}

/**
 * @deprecated Use the analog from @recombine-ai/bosun-lib instead.
 */
export interface StepDef {
    name: string
    type: 'streaming-response' | 'streaming-detect' | 'text'
    prompt: PromptFile | PromptString
    schema?: ZodType
}

/**
 * @deprecated Use the analog from @recombine-ai/bosun-lib instead.
 */
export interface StepRegistry {
    addStep(def: StepDef): void
}

/**
 * a stub registry, that just prints step in logs
 */
/**
 * @deprecated Use the analog from @recombine-ai/bosun-lib instead.
 */
export function createStubRegistry(logger: Logger): StepRegistry {
    return {
        addStep(def) {
            logger.debug('Step registry, step added:', def)
        },
    } as StepRegistry
}

/**
 * @deprecated Use the analog from @recombine-ai/bosun-lib instead.
 */
export function stdPrompt(prompt: PromptFile | string) {
    if (typeof prompt === 'string') {
        return {
            type: 'string',
            content: async () => prompt,
        } as PromptString
    }
    return prompt
}
