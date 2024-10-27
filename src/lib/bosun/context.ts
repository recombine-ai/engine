type Ctx = Record<string, any>
type Paths<T> = T extends object
    ? {
          [K in keyof T]: [K] | [K, ...Paths<T[K]>]
      }[keyof T]
    : never

type PathValue<T, P extends any[]> = P extends [infer First, ...infer Rest]
    ? First extends keyof T
        ? Rest['length'] extends 0
            ? T[First]
            : PathValue<T[First], Rest>
        : never
    : never

class Context<T extends Ctx> {
    #listeners = new Set<(context: T) => void>()
    #context: T
    constructor(context: T) {
        this.#context = context
    }

    set<P extends Paths<T>>(path: P extends any[] ? P : never, value: PathValue<T, P>): void
    set(newContext: T): void
    set(pathOrContext: any, value?: any) {
        if (!this.#context) {
            return
        }
        if (!Array.isArray(pathOrContext)) {
            this.#context = pathOrContext
        } else {
            const path = pathOrContext
            let current = this.#context
            for (let i = 0; i < path.length - 1; i++) {
                current = current[path[i]]
            }
            // @ts-ignore
            current[path[path.length - 1]] = value
        }
        this.#listeners.forEach((listener) => listener(this.#context))
    }

    get() {
        return this.#context
    }

    /** silently swap the context */
    swap(newContext: T) {
        this.#context = newContext
    }

    subscribe = (listener: (context: T) => void) => {
        this.#listeners.add(listener)
        return () => this.#listeners.delete(listener)
    }
}

export function createContext<T extends Ctx>(context: T) {
    return new Context(context)
}

type Public<T> = { [P in keyof T]: T[P] }

type PublicContext<T extends Ctx> = Public<Context<T>>

export type { PublicContext as Context }
