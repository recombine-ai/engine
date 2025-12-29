import { Logger } from '../interfaces'

/**
 * Generic conversational/event tracing used across tools (Bosun, Telescope, apps, etc).
 *
 * This is intentionally separate from:
 * - `StepTrace` (LLM/prompt steps)
 * - `ApiCallTrace` (HTTP/OpenAPI operations)
 *
 * A `ConversationalTrace` represents “something happened in the conversation” (e.g. message received/sent,
 * streaming finished, handler invoked) that UIs may want to show on the same per-call timeline.
 */
export type ConversationalTrace = {
    /** Unique ID for the trace */
    traceId?: string

    /** Identifier used to group traces to the same call/conversation */
    callId?: string

    /** Optional, to group traces within a broader context */
    scopeId?: string

    /** Machine-readable event identifier */
    eventName:
        | 'finished-main-streaming-step'
        | 'llm-handler-stream-requested'
        | 'received-message'
        | 'sent-message'
        | 'transfer-requested'

    /** Role under which this event should be displayed */
    role: 'agent' | 'user' | 'system' | (string & {})

    /** Delivery medium / channel for the conversation */
    medium: 'phone' | 'whatsapp' | (string & {})

    /** Event payload (typically message text or emitted stream text) */
    content: string

    /** Timestamp in milliseconds */
    createdAt: number

    error?: unknown
}

export interface ConversationalTracer {
    addConversationalTrace(trace: ConversationalTrace): void
    flush(): Promise<void>
}

export function createStubConversationalTracer(logger: Logger) {
    return {
        addConversationalTrace(trace: ConversationalTrace) {
            logger.log(`ConversationalTrace: ${trace.eventName}`, trace)
        },
        async flush() {},
    } satisfies ConversationalTracer
}
