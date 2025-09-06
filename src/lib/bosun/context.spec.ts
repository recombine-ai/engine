import { describe, expect, it, vi } from 'vitest'
import { createContext } from './context'

describe('ws-server/context', () => {
    it('sets a value at a path', () => {
        const ctx = createContext({ a: { b: 1 } })
        ctx.set(['a', 'b'], 2)
        expect(ctx.get()).toEqual({ a: { b: 2 } })
    })

    it('sets a new context', () => {
        const ctx = createContext({ a: { b: 1 } })
        ctx.set({ a: { b: 2 } })
        expect(ctx.get()).toEqual({ a: { b: 2 } })
    })

    it('subscribes to context changes', () => {
        const ctx = createContext({ a: { b: 1 } })
        const listener = vi.fn()
        ctx.subscribe(listener)
        ctx.set(['a', 'b'], 2)
        expect(listener).toHaveBeenCalledWith({ a: { b: 2 } })
    })
})
