# Bosun

Bosun is a UI for testing Recombine AI agents. It enables testing complex agent interactions with multiple steps, error handling, and state management.

## Example

```typescript
// In workflows.ts
const agents = {
    "testbot": createTestAgentFactory((props) => {
        return {
            start: async () => { ... },
            reactOnMessage: async () => { ... },
            respondToMessage: async () => { ... }
        }
    })
}

export agents;
```

## Functions

| Function | Description |
| ------ | ------ |
| [createTestAgentFactory](functions/createTestAgentFactory.md) | - |

## Interfaces

| Interface | Description |
| ------ | ------ |
| [TesAgentFactoryProps](interfaces/TesAgentFactoryProps.md) | - |
| [TestAgent](interfaces/TestAgent.md) | - |

## Type Aliases

| Type Alias | Description |
| ------ | ------ |
| [TestAgentFactory](type-aliases/TestAgentFactory.md) | - |
