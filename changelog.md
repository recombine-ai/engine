# Changelog

### 0.4.0 → 0.5.0 (unstable)

Breaking changes

-   Workspaces removed
-   `ai.loadFile` removed

Other changes

-   `FS` interface introduced

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
-   Models → BasicModel
-   Step → LLMStep & ProgrammaticStep
-   makeMessagesList → getConversation
-   Deprecation of shouldExecute (discouraged to use if there's no `maxAttempts` in a step)
