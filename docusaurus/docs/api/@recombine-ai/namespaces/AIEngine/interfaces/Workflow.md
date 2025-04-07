# Workflow

An AI workflow composed of steps.

## Properties

### beforeEach()

```ts
beforeEach: (callback) => void;
```

Registers a callback to be executed before each step.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `callback` | () => `Promise`\<`unknown`\> | Async function to execute before each step |

#### Returns

`void`

***

### rewindTo()

```ts
rewindTo: (step) => void;
```

Rewinds the workflow execution to a specific step.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `step` | [`ProgrammaticStep`](ProgrammaticStep.md) \| [`LLMStep`](LLMStep.md) | The step to rewind to |

#### Returns

`void`

***

### run()

```ts
run: (messages) => Promise<null | string>;
```

Runs the workflow with a given conversation context.
Executes steps sequentially until completion or termination.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `messages` | [`Conversation`](Conversation.md) | The conversation context for the workflow |

#### Returns

`Promise`\<`null` \| `string`\>

The proposed reply if workflow completes, or null if terminated

***

### terminate()

```ts
terminate: () => void;
```

Terminates the workflow, preventing further steps from being executed.

#### Returns

`void`
