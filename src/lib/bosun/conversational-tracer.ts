import type { ConversationalTrace, ConversationalTracer } from '@recombine-ai/telescope'
import { Logger } from '../interfaces'

/**
 * These shapes are owned by `@recombine-ai/telescope` and re-exported here so existing imports from
 * `@recombine-ai/engine` keep resolving.
 *
 * @deprecated Use the analog from @recombine-ai/telescope instead.
 */
export type { ConversationalTrace, ConversationalTracer } from '@recombine-ai/telescope'

/**
 * @deprecated Use the analog from @recombine-ai/telescope instead.
 */
export function createStubConversationalTracer(logger: Logger) {
    return {
        addConversationalTrace(trace: ConversationalTrace) {
            logger.log(`ConversationalTrace: ${trace.eventName}`, trace)
        },
        async flush() {},
    } satisfies ConversationalTracer
}
