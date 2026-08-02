# Changelog

### 1.2.0 → 1.3.0

-   Provider auth and quota failures are now reported as monitoring events. Both `createAIEngine` and
    `createAIStreamEngine` accept an `eventTracer` (from `@recombine-ai/telescope`) and emit
    `provider.auth.failure` on 401/403 and `provider.quota.exceeded` on a 429 caused by quota
    exhaustion. Ordinary rate limiting is logged, not emitted — it clears itself and would bury the
    quota signal. Without an `eventTracer` nothing changes: failures are still logged and still thrown.
-   Added `LlmAdapter#getProviderInfo` / `LlmStreamAdapter#getProviderInfo` (optional), so a failure
    can name the provider and model it came from. The OpenAI adapters implement it, tell
    `azure-openai` apart from `openai`, and report the configured model. Both provider events carry
    `model`; on Azure that is the deployment name, which is the scope both keys and quota are
    allocated against.
-   Tracer types (`StepTrace`, `ApiCallTrace`, `ConversationalTrace` and their tracers) are now
    re-exported from `@recombine-ai/telescope` rather than declared here. Same shapes, one definition;
    the `@deprecated` markers pointing at telescope stay.

### 1.1.0 → 1.2.0

-   Added `StreamingEngineConfig#nunjucksEnv` – Optional nunjucks Environment to customize prompt
    rendering, mirroring `EngineConfig#nunjucksEnv`. Its loader is what `{% include %}` in a
    streaming prompt resolves against; without it the search path is the working directory.
-   **Breaking:** streaming prompts now render with `autoescape: false`, matching `createAIEngine`.
    Context values containing `&`, `<`, `>`, `'` or `"` previously reached the model HTML-escaped
    (`O'Brien` → `O&#39;Brien`).
-   The streaming environment is built once per engine instead of on every run, so it no longer
    replaces the module-level default environment mid-process.
-   `npm run build` now clears `build/` first. `.npmignore` publishes that directory as-is, so
    outputs left behind by earlier versions were shipped alongside the current ones.

### 1.0.0 → 1.1.0

-   Added retries on broken JSON in structured responses.

### 0.11.4 → 1.0.0

-   **Breaking:** `model` field on `LLMStep` is now required and must be an `LlmAdapter` (string model names removed)
-   **Breaking:** OpenAI adapter no longer embeds API-key management; pass a pre-configured `OpenAI` client instead
-   **Breaking:** `AIEngine` now requires `CTX` parameter
-   **Breaking:** Removed deprecated `Conversation.setUserName()` / `setAgentName()` (defaults: "User" / "Agent")
-   **Breaking:** Removed deprecated `Workflow.addStep()` – pass all steps via `WorkflowConfig#steps`
-   **Breaking:** Removed deprecated `EngineConfig.tokenStorage`, `sendAction`, and `tracer` (use `stepRegistry`)
-   **Breaking:** Upgraded `zod` from v3 to v4; replaced `zod-to-json-schema` with built-in `Zod.toJSONSchema`
-   Removed deprecated aliases (`Tracer`, `StepTraceDef`, `BasicModel`, `createConsoleTracer`)
-   Added `createOpenAIStreamAdapter` to `llm-adapters`
-   Added `createMockAdapter` to `llm-adapters` for testing without OpenAI keys
-   Added streaming engine (`createAIStreamEngine`) with filter support
-   Deprecated everything related to Bosun and Telescope in favor of `@recombine/bosun-lib` and `@recombine-ai/telescope`

### 0.11.3 → 0.11.4 (unstable)

-   Added `EngineConfig#nunjucksEnv` – Optional nunjucks Environment to customize prompt rendering.

### 0.11.2 → 0.11.3 (unstable)

-   Added `hangup-requested` conversational trace event type

### 0.11.1 → 0.11.2 (unstable)

-   Remove error suppression from the `onError` hook in the `runStep`

### 0.11.0 → 0.11.1 (unstable)

-   Added `beforeExecute` and `afterExecute` hooks to Workflow configuration.

### 0.10.4 → 0.11.0 (unstable)

-   Breaking change: second argument in `workflow.run(conversation, contextProvider)` now must be a
    function.

### 0.10.3 → 0.10.4 (unstable)

-   Added LLM usage to `StepTrace` interface

### 0.10.2 → 0.10.3 (unstable)

-   Enhanced error handling for AI-generated responses in `runStep`.

### 0.10.2 → 0.10.3 (unstable)

-   Enhanced error handling for AI-generated responses in `runStep`.

### 0.10.0 → 0.10.2 (unstable)

-   pinned zod-to-json-schema version

### 0.9.0 → 0.10.0 (unstable)

-   Traces now require a 'createdAt' timestamp
-   Added ApiCallTrace
-   Added ConversationalTrace
-   Improved error handling in StepTrace

### 0.9.0 → 0.9.1 (unstable)

-   Fix 'response' step trace

### 0.8.8 → 0.9.0 (unstable)

-   All OpenAI structured outputs calls are now strict by default

### 0.8.7 → 0.8.8 (unstable)

-   Better logging for structured response parsing errors

### 0.8.6 → 0.8.7 (unstable)

-   Better validation logging in AIEngine

### 0.8.5 → 0.8.6 (unstable)

-   FIX: Added "schema" option to LlmAdapter.generateResponse()

### 0.8.4 → 0.8.5 (unstable)

-   Clean up logging in favor of StepTracer, which logs everything by default,
-   Deprecated `Tracer` in favor of `StepRegistry` – just renaming.

### 0.8.3 → 0.8.4 (unstable)

-   Enhanced `StepTrace` type with `workflowId` and `workflowRunId` for better trace context.
-   Updated `WorkflowConfig` to include an optional `name` of workflow.

### 0.8.2 → 0.8.3 (unstable)

-   Fixed missing tokenStorage in `LlmAdapter`.

### 0.8.1 → 0.8.2 (unstable)

-   Model now accepts a string or an `LlmAdapter`. Old defaults are used when model is a string.
-   Added OpenAI adapter `createOpenAIAdapter(options)`.

### 0.8.0 → 0.8.1 (unstable)

-   Added prompt context mapping functionality to Context class:
    -   `setPromptContextMapper(promptMapper: (ctx: T) => object)` - how to map Bosun's context into
        prompt context
    -   `getPromptContextMapper()` - retrieves the current prompt context mapper function
    -   Default mapper returns the context as-is

### 0.7.1 → 0.8.0 (unstable)

Breaking changes:

-   `WorkflowControls` parameter added to step `execute` methods - all `ProgrammaticStep`,
    `StringLLMStep`, and `JsonLLMStep` execute functions now receive workflow controls as the last
    parameter,
-   `Workflow.terminate()` and `Workflow.rewindTo()` methods removed - use
    `WorkflowControls.terminate()` and `WorkflowControls.rewindTo()` from within step execution
    instead, note that `WorkflowControls.rewindTo()` accept step name, rather then link to a step,
-   `shouldExecute` property removed from `StringLLMStep` and `JsonLLMStep` interfaces - use
    conditional logic within the `execute` function.
-   `beforeEach` callback also moved into `Workflow.run` as third parameter

Other changes:

-   Added support for additional OpenAI models: `gpt-4o-2024-08-06` and `gpt-4.1-2025-04-14`.

### 0.7.0 → 0.7.1 (unstable)

-   fixed multiple runs on static workflows

### 0.6.0 → 0.7.0 (unstable)

Breaking changes:

-   namespaces removed
-   `TestAgentFactory` now returns a promise
-   `TesAgentFactoryProps` now requires `Tracer` and doesn't require `AIEngine`
-   `loadFile` method was removed in favor of `PromptFS`
-   `workflow.run` now returns a string instead object as a response

Other changes

-   interface `TestVoiceAgent` added
-   interface `Tracer` added
-   interface `PromptFS` and function `createLocalFS` were added
-   added `StepTracer` interface
-   Engine config now accepts `tracer` and `stepTracer`

### 0.5.0 → 0.6.0 (unstable)

Breaking changes:

-   `addDirective` is removed. Use `addMessage` with role: 'system' instead.
-   `ignoreDirectives` → `ignoreAddedMessages`

Other changes:

-   `AIEngine.sendMessage` now accepts `Message` rather than a string

### 0.4.0 → 0.5.0 (unstable)

Breaking changes:

-   `schema` property replaced with `json` which can be boolean,
-   `setDirectiveFormatter` removed

Other changes:

-   `renderPrompt` method added
-   `addDirective` accepts optional formatter function
-   `formatter` optional method added to `Message`

### 0.3.2 → 0.4.0 (unstable)

Breaking changes:

-   `await workflow.run()` now returns an object with `reply: string` and `trace` object

### 0.3.1 → 0.3.2 (unstable)

-   add `ScheduleQuery` class that provides three additional capabilities compared to `delayFactory`:
    -   `query.nextValidDate(date: Date)` – to find next closest date after a specific date (rather than delay)
    -   `query.next()` – gets closest date within provided schedule
    -   `query.isValid(date)` – checks if provided date is within the schedule

### 0.3.0 → 0.3.1 (unstable)

-   Fix: allow other models (as a string)

### 0.2.0 → 0.3.0 (unstable)

Breaking changes:

-   Break down the library into namespace: AIEngine, Scheduler
-   `Models` → `BasicModel`
-   `Step` → `LLMStep` & `ProgrammaticStep`
-   `makeMessagesList` → `getConversation`
-   Deprecation of `shouldExecute` (discouraged to use if there's no `maxAttempts` in a step)
