import { toJSONSchema } from 'zod'
import type { StepTrace, StepTracer } from '@recombine-ai/telescope'
import { Logger } from '../interfaces'

/**
 * These shapes are owned by `@recombine-ai/telescope` and re-exported here so existing imports from
 * `@recombine-ai/engine` keep resolving.
 *
 * @deprecated Use the analog from @recombine-ai/telescope instead.
 */
export type { LlmUsage, StepTrace, StepTracer } from '@recombine-ai/telescope'

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
