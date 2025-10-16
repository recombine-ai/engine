<!-- cspell:words agentic -->

# Recombine AI Engine

A TypeScript library for building agentic workflows for conversational AI.

## Features

-   🔄 Multi-step agentic workflows
-   🎯 Conditional execution and reviewers
-   📝 Structured responses using Zod schemas
-   🗂️ File-based prompts
-   ⚡ Message history management
-   🌍 Context injection using Nunjucks templates
-   👩‍💻 Ready to be integrated with Recombine Bosun prompt-engineering IDE.

## Installation

```sh
npm install @recombine-ai/engine
```

## Basic Usage

```ts
import { createAIEngine } from '@recombine-ai/engine'

const engine = createAIEngine({
    basePath: './path/to/prompts',
})
```

### Creating a Workflow

```ts
// Create message list
const messages = engine.makeMessagesList()
messages.addMessage('User', 'Hello!')

// Define steps
const mainStep = engine.createStep({
    name: 'mainStep',
    prompt: engine.loadFile('conversation/main.txt'),
    context: { userName: 'John Doe' },
    execute: async (response) => {
        messages.setProposedReply(response)
    },
    onError: async (error) => {
        console.error('Error:', error)
    },
})

const myReviewer = engine.createStep({
    /* ... */
})

const myCoordinator = engine.createStep({
    /* ... */
})

// Create and run workflow
const workflow = await engine.createWorkflow(mainStep, myReviewer, myCoordinator)
const { reply, trace } = await workflow.run(messages)
```

## Main concepts

### Workflow & Steps

AI agentic workflow is a chain of prompts where one prompt handles results of another and either
does some side-effects or changes those results.

In Recombine Engine we define these prompts as _steps_. Each step consists of a prompt and a bunch
of related configurations and supporting functions, that e.g. determine whether a side-effect should
happen and what should happen int those side-effects.

#### Step Configuration

```ts
const myStep = engine.createStep({
    name: 'myStep', // Step identifier used for observability
    prompt: 'Here goes your prompt', // Prompt text or file, loaded with engine.loadFile('path')
    schema: zod.object({/* ... */}), // Structured response schema
    context: {userName: 'John Doe'}, // Variables to be used in prompts
    ignoreDirectives: false, // Do not add directives into messages log
    runIf: (messages: Messages) => true, // Run this step or skip it completely
    shouldExecute: (reply: string) => true, // Execute side-effects, if needed
    execute: async (reply: string) => {/* ... */}, // Side effect definition
    onError: (error: string) => {/* ... */}, // Handle error during step execution
    maxAttempts: 3 // Max rewind attempts (for reviewers)
}
```

#### Workflow methods

```ts
const workflow = await engine.createWorkflow(/* workflow steps */)

const reply = await workflow.run(messages) // run the workflow to get the proposed reply at the end
workflow.terminate() // usually used in kill-switch or error handlers: terminates workflow, so no further steps will be executed
workflow.rewind(step) // restart workflow from a particular step
workflow.beforeEach(callback) // a callback to run before each step, e.g. to terminate workflow due to some external reasons
```

## Development

### Setting Up the Development Environment

To contribute to this project, you'll need to set up your local development environment:

1. **Install dependencies:**

    ```sh
    yarn install
    ```

    This project uses `yarn` as its package manager. If you don't have it installed, you can install it with:

    ```sh
    npm install -g yarn
    ```

2. **Set up Git hooks with Husky:**

    Git hooks are automatically installed when you run `yarn install` (via the `prepare` script). The project uses Husky to manage the following Git hooks:

    - **`pre-commit`**: Runs `lint-staged` to format and lint only staged files using Prettier and ESLint
    - **`pre-push`**: Runs TypeScript type checking to ensure no type errors before pushing
    - **`post-merge`**: Automatically runs `yarn install` if `package.json` or `yarn.yaml` changed after a merge

### Available Scripts

-   **`yarn dev`** - Start TypeScript compiler in watch mode
-   **`yarn build`** - Build the project
-   **`yarn typecheck`** - Run TypeScript type checking without emitting files
-   **`yarn test`** - Run tests with Vitest
-   **`yarn lint`** - Lint code with ESLint
-   **`yarn lint:fix`** - Lint and automatically fix issues
-   **`yarn format`** - Format code with Prettier
-   **`yarn format:check`** - Check code formatting without making changes

### Code Quality

The project maintains code quality through:

-   **TypeScript** for type safety
-   **ESLint** for code linting
-   **Prettier** for consistent code formatting
-   **Vitest** for testing
-   **Husky + lint-staged** for automated pre-commit checks
