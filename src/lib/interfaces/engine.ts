import { Environment } from 'nunjucks'
import { StepRegistry, StepTracer } from '../bosun'
import { Conversation, Message } from './conversation'
import { Logger } from './other'
import { StepBuilder } from './steps'
import { Workflow, WorkflowConfig } from './workflow'

/**
 * The main interface for the AI Engine.
 *
 * @example
 * ```typescript
 * import { createAIEngine } from '@recombine-ai/engine'
 *
 * Create a new AI engine instance
 * const ai = createAIEngine({
 *   // engine configuration, see EngineConfig
 * })
 *
 * // create a conversation to be used in workflow.run(), see Conversation
 * const conversation = ai.createConversation(messages)
 * // create a workflow, see WorkflowConfig
 * const workflow = ai.createWorkflow({steps})
 * workflow.run(conversation)
 * ```
 */
export interface AIEngine<CTX extends object> {
    /**
     * Creates a workflow from a sequence of steps.
     * @param config - common parameters for a workflow
     * @returns AI workflow Workflow.
     */
    createWorkflow: (config: WorkflowConfig<CTX>) => Workflow<CTX>

    /**
     * Creates a new conversation instance.
     * @param messages - Optional initial messages for the conversation.
     * @returns A new Conversation object.
     */
    createConversation: (messages?: Message[]) => Conversation

    /**
     * Get the function to create steps to use with {@link WorkflowConfig#steps}
     * if you want to define steps outside of workflow.
     */
    getStepBuilder(): StepBuilder<CTX>

    /**
     * Renders a prompt string using Nunjucks templating engine.
     * @param prompt - The prompt string to render.
     * @param context - Optional context object to use for rendering the prompt.
     * @returns The rendered prompt string.
     */
    renderPrompt: (prompt: string, context?: object) => string
}

/**
 * Configuration options for the Engine.
 */
export interface EngineConfig {
    /**  Optional logger instance for handling log messages.  */
    logger?: Logger
    /** traces received prompt, rendered prompt, context and other useful info about LLM execution */
    stepTracer?: StepTracer

    /** registers steps in workflow to be available in Bosun IDE */
    stepRegistry?: StepRegistry

    /** Optional nunjucks Environment to customize prompt rendering.  */
    nunjucksEnv?: Environment
}
