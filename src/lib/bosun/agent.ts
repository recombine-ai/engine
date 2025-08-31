import { AIEngine, Message } from '../ai'
import { Logger, Scheduler } from '../interfaces'
import { SendAction } from './action'
import { Context } from './context'

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
export interface TesAgentFactoryProps<CTX extends DefaultContext = DefaultContext> {
    // TODO add tracer
    logger: Logger
    scheduler: Scheduler
    ai: AIEngine
    getMessages: () => Message[]
    sendMessage: (message: string | Message) => Promise<void>
    sendAction: SendAction
    ctx: Context<CTX>
}

export interface TestAgent {
    start: () => Promise<unknown>
    reactOnMessage: () => Promise<unknown>
    respondToMessage: () => Promise<unknown>
    isAssigned: () => Promise<boolean>
    onFatalError: (error: Error) => Promise<unknown>
}
// TODO add TestVoiceAgent

export type TestAgentFactory<T extends DefaultContext = DefaultContext> = (
    props: TesAgentFactoryProps<T>,
) => TestAgent

// TODO creator can be async
export function createTestAgentFactory<T extends DefaultContext>(creator: TestAgentFactory<T>) {
    return creator
}
