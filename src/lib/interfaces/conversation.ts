/**
 * Represents a conversation between a user and an AI agent.
 * Provides methods to manage the conversation flow, format messages, and convert the conversation
 * to a string representation.
 */
export interface Conversation {
    /**
     * Sets the default formatter to stringify messages when toString is called.
     * @param formatter - A function that takes a message and returns a formatted string.
     */
    setDefaultFormatter: (formatter: (message: Message) => string) => void

    /**
     * Converts the conversation to a string representation to be fed to an LLM.
     * @param filter - A function that filters messages based on certain criteria.
     * @example
     * @returns The string representation of the conversation.
     */
    toString: (options?: { ignoreAddedMessages?: boolean }) => string

    /**
     * Adds a message from a specified sender to the conversation.
     * @param message - The message to add to the conversation.
     */
    addMessage: (message: Message, opts?: { formatter?: (message: Message) => string }) => void

    /**
     * Sets a custom formatter for proposed messages.
     * @param formatter - A function that takes a message string and returns a formatted string.
     */
    setProposedMessageFormatter: (formatter: (message: string) => string) => void

    /**
     * Sets a proposed reply message.
     * @param message - The proposed reply message.
     */
    setProposedReply: (message: string) => void

    /**
     * Gets the current proposed reply message.
     * @returns The proposed reply message, or null if none exists.
     */
    getProposedReply: () => string | null

    /**
     * Gets the history of all messages in the conversation. Returns {@link Message} rather than
     * {@link ConversationMessage} because none of the {@link ConversationMessage} properties should
     * be accessed outside of the {@link Conversation} context.
     * @returns An array of Message objects representing the conversation history.
     */
    getHistory: () => Message[]
}

/**
 * Represents a message in a conversation between a user and an agent, or a system message.
 * Messages can contain text and optionally an image URL. To be used in the {@link Conversation} interface.
 */
export interface Message {
    /** The sender of the message, which can be one of the following: 'user', 'agent', or 'system' */
    sender: 'user' | 'agent' | 'system'
    /** The text content of the message */
    text: string
    /** Optional URL of an image associated with the message */
    imageUrl?: string
}
