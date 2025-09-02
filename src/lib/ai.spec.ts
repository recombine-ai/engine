import { describe, it, expect } from 'vitest'
import { AIEngine, createAIEngine } from './ai'

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