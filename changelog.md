# Changelog

### 0.3.0 → 0.3.1 (unstable)

-   Fix: allow other models (as a string)

### 0.2.0 → 0.3.0 (unstable)

Breaking changes:

-   Break down the library into namespace: AIEngine, Scheduler
-   Models → BasicModel
-   Step → LLMStep & ProgrammaticStep
-   makeMessagesList → getConversation
-   Deprecation of shouldExecute (discouraged to use if there's no `maxAttempts` in a step)
