import { Logger } from '../interfaces'

export type ApiCallTrace = {
    /** Unique ID for the trace */
    traceId?: string

    /** Identifier used to group traces to the same call/conversation */
    callId?: string

    /** Optional, to group traces within a broader context */
    scopeId?: string

    operationName: string
    method: string
    path: string

    baseUrl?: string

    /** Raw request details (will typically be stringified by storage) */
    request?: unknown

    /** Raw response details (will typically be stringified by storage) */
    response?: unknown

    status?: number
    ok?: boolean
    durationMs?: number

    error?: unknown

    /** Timestamp in milliseconds */
    createdAt?: number
}

export interface ApiCallTracer {
    addApiCallTrace(trace: ApiCallTrace): void
    flush(): Promise<void>
}

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
