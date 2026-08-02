import type { ApiCallTrace, ApiCallTracer } from '@recombine-ai/telescope'
import { Logger } from '../interfaces'

/**
 * These shapes are owned by `@recombine-ai/telescope` and re-exported here so existing imports from
 * `@recombine-ai/engine` keep resolving.
 *
 * @deprecated Use the analog from @recombine-ai/telescope instead.
 */
export type { ApiCallTrace, ApiCallTracer } from '@recombine-ai/telescope'

/**
 * @deprecated Use the analog from @recombine-ai/telescope instead.
 */
export function createStubApiCallTracer(logger: Logger) {
    return {
        addApiCallTrace(trace: ApiCallTrace) {
            logger.log(
                `ApiCallTrace: ${trace.operationName} (${trace.method} ${trace.path})`,
                trace,
            )
        },
        async flush() {},
    } satisfies ApiCallTracer
}
