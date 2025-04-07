# AIEngine

The main interface for the AI Engine.

## Example

```typescript
import { AIEngine } from './lib/ai'

// Create a new AI engine instance
const ai = AIEngine.createAIEngine()

// Create a conversation
const conversation = ai.createConversation()
conversation.addMessage('user', 'I need help with my order')

// Define workflow steps
const killswitch = ai.createStep({
  name: 'killswitch',
  prompt: ai.loadFile('prompts/killswitch.njk'),
  execute: async (reply) => {
    const result = JSON.parse(reply)
    if (result.terminate) {
      conversation.addDirective(`Terminating workflow: ${result.reason}`)
      return workflow.terminate()
    }
  },
  onError: async (error) => conversation.addDirective(`Error in killswitch: ${error}`)
})

const analyzeIntent = ai.createStep({
  name: 'analyze-intent',
  prompt: ai.loadFile('prompts/analyze-intent.njk'),
  execute: async (reply) => {
    const intent = JSON.parse(reply)
    conversation.addDirective(`User intent is: ${intent.category}`)
  },
  onError: async (error) => conversation.addDirective(`Error analyzing intent: ${error}`)
})

const mainReply = ai.createStep({
  name: 'main-reply',
  prompt: ai.loadFile('prompts/generate-response.njk'),
  execute: async (reply) => conversation.setProposedReply(reply),
  onError: async (error) => conversation.setProposedReply(`I'm sorry, I'm having trouble right now.`)
})

// Create and run the workflow
const workflow = await ai.createWorkflow(killswitch, analyzeIntent, mainReply)
const response = await workflow.run(conversation)
console.log(response)
```

## Properties

### createConversation()

```ts
createConversation: (messages?) => Conversation;
```

Creates a new conversation instance.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `messages`? | [`Message`](Message.md)[] | Optional initial messages for the conversation. |

#### Returns

[`Conversation`](Conversation.md)

A new Conversation object.

***

### createStep()

```ts
createStep: <T>(step) => T;
```

Creates a step that can be used in a workflow.

#### Type Parameters

| Type Parameter |
| ------ |
| `T` *extends* [`ProgrammaticStep`](ProgrammaticStep.md) \| [`LLMStep`](LLMStep.md) |

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `step` | `T` | The LLM or programmatic step to create. |

#### Returns

`T`

The created step of the same type as the input.

***

### createWorkflow()

```ts
createWorkflow: (...steps) => Promise<Workflow>;
```

Creates a workflow from a sequence of steps.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| ...`steps` | ([`ProgrammaticStep`](ProgrammaticStep.md) \| [`LLMStep`](LLMStep.md))[] | An array of LLM or programmatic steps to be executed in order. |

#### Returns

`Promise`\<[`Workflow`](Workflow.md)\>

A Promise that resolves to the created Workflow.

***

### loadFile()

```ts
loadFile: (path) => File;
```

Loads a file from the specified path.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `path` | `string` | The path to the file to load. |

#### Returns

[`File`](File.md)

The loaded File object.
