import * as Zod from 'zod'
import { PromptFile } from '../prompt-fs'
import { LlmAdapter } from './adapter'
import { Conversation } from './conversation'
import { WorkflowControls } from './workflow'

export interface BasicStep<CTX> {
    /** Step name  */
    name: string

    /** Determines if the step should be run or not */
    runIf?: (messages: Conversation, ctx: CTX) => boolean | Promise<boolean>

    /**
     * When provided, throws an error if the step is invoked more times than `maxAttempts`.
     * Number of attempts taken is reset when the flow passed the step that was rewinding.
     */
    maxAttempts?: number

    /** Error handler called if an error occurred during in `execute` function */
    onError?: (error: string, ctx: CTX) => Promise<unknown>
}

export interface ProgrammaticStep<CTX> extends BasicStep<CTX> {
    /** Content of the step */
    execute: (messages: Conversation, ctx: CTX, workflow: WorkflowControls) => Promise<unknown>
}

export interface LLMStep<CTX> extends BasicStep<CTX> {
    /** LLM adapter to use */
    model: LlmAdapter

    /**
     * Prompt can be a simple string or a link to a file, loaded with `loadFile` function which
     * takes a path to the file relative to `src/use-cases` directory. Should be Nunjucks-compatible.
     */
    prompt: string | PromptFile

    /**
     * Do not put messages that were added via {@link Conversation.addMessage} into the prompt.
     */
    ignoreAddedMessages?: boolean
}

export interface JsonLLMStep<CTX, Schema extends Zod.ZodType> extends LLMStep<CTX> {
    /**
     * Defines the expected structure of the LLM's output. Accepts ZodSchema. When provided, the
     * LLM's response is validated and parsed according to this schema ensuring reliable structured
     * output.
     */
    schema: Schema
    /**
     * Function to execute with the LLM's response. Use {@link setProposedReply} to use the LLM's output as the proposed reply.
     * Or use combination of {@link getProposedReply} and {@link setProposedReply} to substitute parts of the string.
     * @example
     * ```
     * // Use LLM output directly as reply
     * execute: (reply) => messages.setProposedReply(reply)
     *
     * // Substitute tokens in LLM output
     * execute: (reply) => {
     *   const withLink = reply.replace('<PAYMENT_LINK>', 'https://payment.example.com/123')
     *   messages.setProposedReply(withLink)
     * }
     * ```
     */
    execute: (
        reply: Zod.infer<Schema>,
        conversation: Conversation,
        ctx: CTX,
        workflowControls: WorkflowControls,
    ) => Promise<unknown>
}

export interface StringLLMStep<CTX> extends LLMStep<CTX> {
    /**
     * Function to execute with the LLM's response. Use {@link setProposedReply} to use the LLM's output as the proposed reply.
     * Or use combination of {@link getProposedReply} and {@link setProposedReply} to substitute parts of the string.
     * @example
     * ```
     * // Use LLM output directly as reply
     * execute: (reply) => messages.setProposedReply(reply)
     *
     * // Substitute tokens in LLM output
     * execute: (reply) => {
     *   const withLink = reply.replace('<PAYMENT_LINK>', 'https://payment.example.com/123')
     *   messages.setProposedReply(withLink)
     * }
     * ```
     */
    execute: (
        reply: string,
        conversation: Conversation,
        ctx: CTX,
        workflowControls?: WorkflowControls,
    ) => Promise<unknown>
}

export type WorkflowStep<CTX> = StringLLMStep<CTX> | JsonLLMStep<CTX, any> | ProgrammaticStep<CTX>

export interface StepBuilder<CTX> {
    <Schema extends Zod.ZodType>(step: JsonLLMStep<CTX, Schema>): JsonLLMStep<CTX, Schema>
    (step: StringLLMStep<CTX>): StringLLMStep<CTX>
    (step: ProgrammaticStep<CTX>): ProgrammaticStep<CTX>
}
