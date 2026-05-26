import { Logger, Message, Scheduler } from '../interfaces'
import { Context } from './context'
import { StepRegistry } from './step-registry'
import { StepTracer } from './step-tracer'
import { ApiCallTracer } from './api-call-tracer'
import { ConversationalTracer } from './conversational-tracer'

/**
 * Bosun is a UI for testing Recombine AI agents. It enables testing complex agent interactions with
 * multiple steps, error handling, and state management.
 *
 * @example
 * ```typescript
 * // In workflows.ts
 * const agents = {
 *     "testBot": createTestAgentFactory((props) => {
 *         return {
 *             start: async () => { ... },
 *             reactOnMessage: async () => { ... },
 *             respondToMessage: async () => { ... }
 *         }
 *     })
 * }
 *
 * export agents;
 * ```
 */
type DefaultContext = Record<string, any>
/**
 * @deprecated Use the analog from @recombine-ai/bosun-lib instead.
 */
export interface TestAgentFactoryProps<CTX extends DefaultContext = DefaultContext> {
    stepRegistry: StepRegistry
    /**
     * Optional tracer for recording API calls (e.g. generated OpenAPI SDK operations).
     *
     * Workflows should pass this down (scoped with a `conversationId`) so Bosun/Telescope UIs can render API calls in the same per-call timeline as step traces.
     */
    apiCallTracer?: ApiCallTracer
    /**
     * Optional tracer for recording conversational events (messages, streaming markers, etc).
     *
     * Workflows should pass this down (scoped with a `conversationId`) so UIs can render a mixed per-conversation timeline.
     */
    conversationalTracer?: ConversationalTracer
    stepTracer: StepTracer
    logger: Logger
    scheduler: Scheduler
    getMessages: () => Message[]
    sendMessage: (message: string | Message) => Promise<void>
    ctx: Context<CTX>
}

/**
 * @deprecated Use the analog from @recombine-ai/bosun-lib instead.
 */
export interface TestTextAgent {
    start: () => Promise<unknown>
    reactOnMessage: () => Promise<unknown>
    respondToMessage: () => Promise<unknown>
    isAssigned: () => Promise<boolean>
    onFatalError: (error: Error) => Promise<unknown>
}
/**
 * @deprecated Use the analog from @recombine-ai/bosun-lib instead.
 */
export interface TestVoiceAgent {
    streamResponse: () => Promise<unknown>
    onCallEnd: () => Promise<unknown>
    onCallStart: () => Promise<unknown>
    onFatalError: (error: Error) => Promise<unknown>
    // TODO move this to ctx.
    resetContext: () => Promise<unknown>
}

/**
 * @deprecated Use the analog from @recombine-ai/bosun-lib instead.
 */
export type TestAgent = TestTextAgent | TestVoiceAgent

/**
 * @deprecated Use the analog from @recombine-ai/bosun-lib instead.
 */
export type TestAgentFactory<T extends DefaultContext = DefaultContext> = (
    props: TestAgentFactoryProps<T>,
) => Promise<TestAgent>

/**
 * @deprecated Use the analog from @recombine-ai/bosun-lib instead.
 */
export function createTestAgentFactory<T extends DefaultContext>(creator: TestAgentFactory<T>) {
    return creator
}
