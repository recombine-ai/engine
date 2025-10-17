# Changelog

### 0.6.0 → 0.7.1 (unstable)

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
