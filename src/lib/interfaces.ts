export interface Logger {
    log: (...args: any[]) => void
    debug: (...args: any[]) => void
    error: (...args: any[]) => void
}

/**
 * A function that schedules an action to be executed in the future
 * @param delay – a date when the action should be executed use {@link delayFactory} to create a
 * date
 * @param phone – user's phone
 */
export type ScheduleAction = (delay: Date, phone: string) => Promise<void>
export interface Scheduler {
    /**
     * Register a delayed action handler.
     * @param actionName – a unique (inside one use-case) name for the action
     * @param action – a function that will be called when the action is triggered
     * @returns a function to schedule the action
     */
    registerAction: (
        actionName: string,
        action: (phone: string) => Promise<unknown>,
    ) => ScheduleAction

    /**
     * Removes all actions for the given phone that were not executed yet.
     */
    clearAllPendingActions: (phone: string) => Promise<unknown>
}
