import { AiEngine } from '../ai'
import { Logger, Message, Scheduler } from '../interfaces'
import { SendAction } from './action'
import { Context } from './context'

type DefaultContext = Record<string, any>
export interface TesAgentFactoryProps<CTX extends DefaultContext = DefaultContext> {
    logger: Logger
    scheduler: Scheduler
    ai: AiEngine
    getMessages: () => Message[]
    sendMessage: (message: string) => Promise<void>
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

export type TestAgentFactory<T extends DefaultContext = DefaultContext> = (
    props: TesAgentFactoryProps<T>,
) => TestAgent

export function createTestAgentFactory<T extends DefaultContext>(creator: TestAgentFactory<T>) {
    return creator
}
