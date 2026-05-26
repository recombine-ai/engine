import { Logger } from '../interfaces'

/**
 * Generic conversational event tracing. Represents “something happened in the conversation” (e.g.
 * message received/sent, streaming finished, handler invoked) that UIs may want to show on the same
 * per-conversation timeline.
 */
/**
 * @deprecated Use the analog from @recombine-ai/telescope instead.
 */
export type ConversationalTrace = {
    /** Unique ID for the trace */
    traceId?: string

    /** Identifier used to group traces to the same call/conversation */
    conversationId?: string

    /** Optional, to group traces within a broader context */
    scopeId?: string

    /** Machine-readable event identifier */
    eventName:
        | 'finished-main-streaming-step'
        | 'llm-handler-stream-requested'
        | 'received-message'
        | 'sent-message'
        | 'transfer-requested'
        | 'hangup-requested'

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

/**
 * @deprecated Use the analog from @recombine-ai/telescope instead.
 */
export interface ConversationalTracer {
    addConversationalTrace(trace: ConversationalTrace): void
    flush(): Promise<void>
}

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
