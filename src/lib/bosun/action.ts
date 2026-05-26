// TODO drop this!

/**
 * @deprecated Use the analog from @recombine-ai/bosun-lib instead.
 */
export interface Action {
    id: string
    type: string
    state: 'started' | 'completed' | 'failed'
    message: string
}

/**
 * @deprecated Use the analog from @recombine-ai/bosun-lib instead.
 */
export type SendAction = (action: Action) => Promise<void>

/**
 * @deprecated Use the analog from @recombine-ai/bosun-lib instead.
 */
export function makeActionWrapper(sendAction: SendAction) {
    return async function wrapAction(
        message: string,
        type: string,
        action: () => Promise<unknown>,
    ) {
        const id = Math.random().toString()
        await sendAction({
            id,
            type,
            state: 'started',
            message,
        })
        await action()
        await sendAction({
            id,
            type,
            state: 'completed',
            message,
        })
    }
}

/**
 * @deprecated Use the analog from @recombine-ai/bosun-lib instead.
 */
export function makeAction(sendAction: SendAction | undefined, type: string, message: string) {
    if (!sendAction) {
        // noop
        return async function action() {}
    }
    const id = Math.random().toString()
    return function action(state: Action['state'] = 'completed') {
        return sendAction({
            id,
            type,
            state,
            message,
        })
    }
}
