import { Message } from '../ai'
import { Logger, Scheduler } from '../interfaces'
import { SendAction } from './action'
import { Context } from './context'
import { StepRegistry, Tracer } from './tracer'
import { StepTracer } from './stepTracer'
import { ApiCallTracer } from './apiCallTracer'
import { ConversationalTracer } from './conversationalTracer'

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
export interface TestAgentFactoryProps<CTX extends DefaultContext = DefaultContext> {
    /** @deprecated */
    tracer: Tracer
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
    sendAction: SendAction
    ctx: Context<CTX>
}

export interface TestTextAgent {
    start: () => Promise<unknown>
    reactOnMessage: () => Promise<unknown>
    respondToMessage: () => Promise<unknown>
    isAssigned: () => Promise<boolean>
    onFatalError: (error: Error) => Promise<unknown>
}
export interface TestVoiceAgent {
    streamResponse: () => Promise<unknown>
    onCallEnd: () => Promise<unknown>
    onCallStart: () => Promise<unknown>
    onFatalError: (error: Error) => Promise<unknown>
    // TODO move this to ctx.
    resetContext: () => Promise<unknown>
}

export type TestAgent = TestTextAgent | TestVoiceAgent

export type TestAgentFactory<T extends DefaultContext = DefaultContext> = (
    props: TestAgentFactoryProps<T>,
) => Promise<TestAgent>

export function createTestAgentFactory<T extends DefaultContext>(creator: TestAgentFactory<T>) {
    return creator
}
