# Changelog

### 0.10.0 → 0.10.1 (unstable)

- pinned zod-to-json-schema version

### 0.9.0 → 0.10.0 (unstable)

- Traces now require a 'createdAt' timestamp
- Added ApiCallTrace
- Added ConversationalTrace
- Improved error handling in StepTrace

### 0.9.0 → 0.9.1 (unstable)

- Fix 'response' step trace

### 0.8.8 → 0.9.0 (unstable)

- All OpenAI structured outputs calls are now strict by default

### 0.8.7 → 0.8.8 (unstable)

- Better logging for structured response parsing errors

### 0.8.6 → 0.8.7 (unstable)

- Better validation logging in AIEngine

### 0.8.5 → 0.8.6 (unstable)

- FIX: Added "schema" option to LlmAdapter.generateResponse()

### 0.8.4 → 0.8.5 (unstable)

- Clean up logging in favor of StepTracer, which logs everything by default,
- Deprecated `Tracer` in favor of `StepRegistry` – just renaming.

### 0.8.3 → 0.8.4 (unstable)

- Enhanced `StepTrace` type with `workflowId` and `workflowRunId` for better trace context.
- Updated `WorkflowConfig` to include an optional `name` of workflow.

### 0.8.2 → 0.8.3 (unstable)

- Fixed missing tokenStorage in `LlmAdapter`.

### 0.8.1 → 0.8.2 (unstable)

- Model now accepts a string or an `LlmAdapter`. Old defaults are used when model is a string.
- Added OpenAI adapter `createOpenAIAdapter(options)`.

### 0.8.0 → 0.8.1 (unstable)

- Added prompt context mapping functionality to Context class:
    - `setPromptContextMapper(promptMapper: (ctx: T) => object)` - how to map Bosun's context into
      prompt context
    - `getPromptContextMapper()` - retrieves the current prompt context mapper function
    - Default mapper returns the context as-is

### 0.7.1 → 0.8.0 (unstable)

Breaking changes:

- `WorkflowControls` parameter added to step `execute` methods - all `ProgrammaticStep`,
  `StringLLMStep`, and `JsonLLMStep` execute functions now receive workflow controls as the last
  parameter,
- `Workflow.terminate()` and `Workflow.rewindTo()` methods removed - use
  `WorkflowControls.terminate()` and `WorkflowControls.rewindTo()` from within step execution
  instead, note that `WorkflowControls.rewindTo()` accept step name, rather then link to a step,
- `shouldExecute` property removed from `StringLLMStep` and `JsonLLMStep` interfaces - use
  conditional logic within the `execute` function.
- `beforeEach` callback also moved into `Workflow.run` as third parameter

Other changes:

- Added support for additional OpenAI models: `gpt-4o-2024-08-06` and `gpt-4.1-2025-04-14`.

### 0.7.0 → 0.7.1 (unstable)

- fixed multiple runs on static workflows

### 0.6.0 → 0.7.0 (unstable)

Breaking changes:

- namespaces removed
- `TestAgentFactory` now returns a promise
- `TesAgentFactoryProps` now requires `Tracer` and doesn't require `AIEngine`
- `loadFile` method was removed in favor of `PromptFS`
- `workflow.run` now returns a string instead object as a response

Other changes

- interface `TestVoiceAgent` added
- interface `Tracer` added
- interface `PromptFS` and function `createLocalFS` were added
- added `StepTracer` interface
- Engine config now accepts `tracer` and `stepTracer`

### 0.5.0 → 0.6.0 (unstable)

Breaking changes:

- `addDirective` is removed. Use `addMessage` with role: 'system' instead.
- `ignoreDirectives` → `ignoreAddedMessages`

Other changes:

- `AIEngine.sendMessage` now accepts `Message` rather than a string

### 0.4.0 → 0.5.0 (unstable)

Breaking changes:

- `schema` property replaced with `json` which can be boolean,
- `setDirectiveFormatter` removed

Other changes:

- `renderPrompt` method added
- `addDirective` accepts optional formatter function
- `formatter` optional method added to `Message`

### 0.3.2 → 0.4.0 (unstable)

Breaking changes:

- `await workflow.run()` now returns an object with `reply: string` and `trace` object

### 0.3.1 → 0.3.2 (unstable)

- add `ScheduleQuery` class that provides three additional capabilities compared to `delayFactory`:
    - `query.nextValidDate(date: Date)` – to find next closest date after a specific date (rather than delay)
    - `query.next()` – gets closest date within provided schedule
    - `query.isValid(date)` – checks if provided date is within the schedule

### 0.3.0 → 0.3.1 (unstable)

- Fix: allow other models (as a string)

### 0.2.0 → 0.3.0 (unstable)

Breaking changes:

- Break down the library into namespace: AIEngine, Scheduler
- `Models` → `BasicModel`
- `Step` → `LLMStep` & `ProgrammaticStep`
- `makeMessagesList` → `getConversation`
- Deprecation of `shouldExecute` (discouraged to use if there's no `maxAttempts` in a step)
