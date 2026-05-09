import { Logger } from '../interfaces'

/**
 * Generic API-call tracing used across tools (Bosun, Telescope, generated OpenAPI clients, etc).
 *
 * The OpenAPI SDK can describe *what* was called (operation/method/path + inputs) but it typically cannot infer
 * your domain "call"/"conversation" identifier. To get a per-call UI timeline, scope your tracer in the app
 * layer by injecting `conversationId` onto every `ApiCallTrace` before passing it to the SDK.
 */
export type ApiCallTrace = {
    /** Unique ID for the trace */
    traceId?: string

    /** Identifier used to group traces to the same call/conversation */
    conversationId?: string

    /** Optional, to group traces within a broader context */
    scopeId?: string

    /** Human-readable operation name */
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
    createdAt: number
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
