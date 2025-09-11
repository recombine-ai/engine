import { describe, it, expect } from 'vitest'
import { AIEngine, createAIEngine, validatePrompts } from './ai'

describe('conversationExample', () => {
    it('outputs conversation string ignoring added messages', () => {
        const engine = createAIEngine()
        const conversation = engine.createConversation([
            {
                sender: 'user',
                text: 'Hello, I need help with my order.',
            },
            {
                sender: 'agent',
                text: 'Sure, I can help you with that.',
            },
        ])

        conversation.setUserName('Client')
        conversation.setAgentName('Support')
        conversation.addMessage({ sender: 'user', text: 'I need help with my account' })
        conversation.addMessage({ sender: 'system', text: 'Ask for account details' })
        conversation.setProposedReply('Please provide your account number')

        const outputIgnoringAdded = conversation.toString({ ignoreAddedMessages: true })
        const expectedIgnoring = [
            'Client: Hello, I need help with my order.',
            'Support: Sure, I can help you with that.',
            'Proposed reply: Please provide your account number',
        ].join('\n')
        expect(outputIgnoringAdded).toBe(expectedIgnoring)
    })

    it('outputs full conversation string including added messages and proposed reply', () => {
        const engine = createAIEngine()
        const conversation = engine.createConversation([
            {
                sender: 'user',
                text: 'Hello, I need help with my order.',
                imageUrl: 'https://example.com/image.png',
            },
            {
                sender: 'agent',
                text: 'Sure, I can help you with that.',
                imageUrl: 'https://example.com/agent-image.png',
            },
        ])

        conversation.setUserName('Client')
        conversation.setAgentName('Support')
        conversation.addMessage({ sender: 'user', text: 'I need help with my account' })
        conversation.addMessage({ sender: 'system', text: 'Ask for account details' })
        conversation.setProposedReply('Please provide your account number')

        const outputFull = conversation.toString()
        const expectedFull = [
            'Client: Hello, I need help with my order.',
            'Support: Sure, I can help you with that.',
            'Client: I need help with my account',
            'System: Ask for account details',
            'Proposed reply: Please provide your account number',
        ].join('\n')
        expect(outputFull).toBe(expectedFull)
    })
})

describe('validatePrompts', () => {
    it('detects used, missing and unused variables (basic)', () => {
        const ctx = { user: { name: 'John', id: 12 }, date: '14-01-2000' }
        const tpl = 'Hello, {{user.name}}. Your id is {{id}}. The date is {{date}}'
        const res = validatePrompts({ prompt: tpl, context: ctx })
        expect(res.isValidLiquidJs).toBe(true)
        expect(res.usedVariablesFromContext.sort()).toEqual(['date', 'user.name'])
        expect(res.variablesMissingFromContext).toEqual(['id'])
        expect(res.mistypedVariables).toEqual([])
        expect(new Set(res.unusedVariablesFromContext)).toContain('user')
        expect(new Set(res.unusedVariablesFromContext)).toContain('user.id')
    })

    it('reports type mismatch for numeric index on non-array', () => {
        const ctx = { user: { name: 'John' } }
        const tpl = '{{ user[0] }}'
        const res = validatePrompts({ prompt: tpl, context: ctx })
        expect(res.variablesMissingFromContext).toEqual(['user[0]'])
        expect(res.mistypedVariables[0]).toMatchObject({
            variable: 'user[0]',
            expectedType: 'array',
            actualType: 'object',
        })
    })

    it('reports type mismatch for dot access on non-object', () => {
        const ctx = { count: 5 }
        const tpl = '{{ count.value }}'
        const res = validatePrompts({ prompt: tpl, context: ctx })
        expect(res.variablesMissingFromContext).toEqual(['count.value'])
        expect(res.mistypedVariables[0]).toMatchObject({
            variable: 'count.value',
            expectedType: 'object',
            actualType: 'number',
        })
    })

    it('resolves dynamic keys like a[b.c]', () => {
        const ctx = { a: { k: 1 }, b: { c: 'k' } }
        const tpl = '{{ a[b.c] }}'
        const res = validatePrompts({ prompt: tpl, context: ctx })
        expect(res.usedVariablesFromContext).toContain('a[b.c]')
        // b.c itself may not appear as used; we still ensure no missing
        expect(res.variablesMissingFromContext).toEqual([])
    })

    it('handles arrays with property access', () => {
        const ctx = { users: [{ id: 1 }] }
        const tpl = '{{ users[0].id }}'
        const res = validatePrompts({ prompt: tpl, context: ctx })
        expect(res.usedVariablesFromContext).toContain('users[0].id')
        expect(res.variablesMissingFromContext).toEqual([])
    })

    it('marks invalid Liquid as isValidLiquidJs=false', () => {
        const ctx = { user: { name: 'John' } }
        const tpl = '{{ user.name '
        const res = validatePrompts({ prompt: tpl, context: ctx })
        expect(res.isValidLiquidJs).toBe(false)
    })
})
