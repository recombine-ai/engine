export class MessageStartFilter extends TransformStream<string, string> {
    constructor(toRemove: string) {
        const prefix = toRemove.toLowerCase()
        let buffer = ''
        let done = false

        const releaseChunks = (controller: TransformStreamDefaultController<string>) => {
            done = true
            const out = buffer.toLowerCase().startsWith(prefix)
                ? buffer.slice(toRemove.length)
                : buffer
            if (out) {
                controller.enqueue(out)
            }
        }

        super({
            transform(chunk, controller) {
                if (done) {
                    // just pass through
                    controller.enqueue(chunk)
                    return
                }

                buffer += chunk

                if (buffer.length >= prefix.length) {
                    // Seen enough to know for certain.
                    releaseChunks(controller)
                } else if (!prefix.startsWith(buffer.toLowerCase())) {
                    // Still short, but already diverged — no point waiting for more.
                    releaseChunks(controller)
                }
                // else: still a viable partial prefix → keep buffering
            },

            flush(controller) {
                // Stream ended before we ever reached a decision.
                if (!done && buffer) {
                    releaseChunks(controller)
                }
            },
        })
    }
}

export function agentFilter() {
    return new MessageStartFilter('agent:')
}

export function composeTokenTransformers(
    transformers: TransformStream<string, string>[],
): TransformStream<string, string> {
    if (transformers.length === 0) {
        // Empty pipeline = pass strings through unchanged.
        return new TransformStream<string, string>()
    }

    const writable = transformers[0].writable
    let readable = transformers[0].readable
    for (let i = 1; i < transformers.length; i++) {
        readable = readable.pipeThrough(transformers[i])
    }
    return { writable, readable }
}
