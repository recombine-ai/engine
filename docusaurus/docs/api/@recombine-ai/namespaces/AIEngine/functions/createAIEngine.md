# createAIEngine()

```ts
function createAIEngine(cfg): AIEngine;
```

Creates an AI Engine with the given configuration.

The AI Engine provides utilities for creating and running conversational workflows
with large language models, specifically OpenAI GPT models.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `cfg` | [`EngineConfig`](../interfaces/EngineConfig.md) |

## Returns

[`AIEngine`](../interfaces/AIEngine.md)

An AIEngine instance.

## Example

```ts
const engine = createAIEngine({
  logger: customLogger,
  basePath: '/path/to/prompts'
});

const workflow = await engine.createWorkflow(
  engine.createStep({
    name: 'generate-response',
    prompt: engine.loadFile('prompts/response.txt'),
    execute: (response) => conversation.setProposedReply(response)
  })
);

const reply = await workflow.run(conversation);
```
