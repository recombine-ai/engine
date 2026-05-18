import { Conversation } from './conversation'
import { WorkflowStep } from './steps'

export interface WorkflowControls {
    /**
     * Terminates the workflow, preventing further steps from being executed.
     */
    terminate: () => void

    /**
     * Rewinds the workflow execution to a specific step.
     * @param step - The name of the step to rewind to
     */
    rewindTo: (step: string) => void
}

export type BeforeEachStep<CTX> = (
    conversation: Conversation,
    ctx: CTX,
    workflowControls?: WorkflowControls,
) => Promise<void>

/**
 * An AI workflow composed of steps.
 */
export interface Workflow<CTX> {
    /**
     * Runs the workflow with a given conversation context.
     * Executes steps sequentially until completion or termination.
     * @param conversation - The conversation context for the workflow
     * @param contextProvider - A provider function for the context that will be passed to all steps and to all prompts in those steps
     * @param beforeEach - A callback, that runs before each step
     * @returns The proposed reply if workflow completes, or null if terminated
     */
    run: (
        conversation: Conversation,
        contextProvider: (() => CTX) | (() => Promise<CTX>),
        beforeEach?: BeforeEachStep<CTX>,
    ) => Promise<string | null>
}

/**
 * Config object to be used in {@link AIEngine#createWorkflow}
 */
export interface WorkflowConfig<CTX> {
    /** workflow name, to use in traces, defaults to 'workflow' */
    name?: string
    /** a function that will run once, if any of the steps going to be executed */
    beforeExecute?: (ctx: CTX) => Promise<void>
    /** a function that will run once, if any of the steps was executed */
    afterExecute?: (ctx: CTX) => Promise<void>
    /** common error handler for workflow */
    onError: (error: string, ctx: CTX) => Promise<unknown>
    /** workflow steps {@link ProgrammaticStep}, {@link StringLLMStep} or {@link JsonLLMStep} */
    steps?: WorkflowStep<CTX>[]
}
