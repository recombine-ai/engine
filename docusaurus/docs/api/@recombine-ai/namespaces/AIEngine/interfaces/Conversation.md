# Conversation

Represents a conversation between a user and an AI agent.
Provides methods to manage the conversation flow, format messages, and convert the conversation to a string representation.

## Example

```typescript
// Create a new conversation instance
const conversation = new Conversation();

// Set names for the participants
conversation.setUserName("Client");
conversation.setAgentName("Support");

// Add messages to the conversation
conversation.addMessage("user", "I need help with my account");
conversation.addDirective("Ask for account details");

// Get the conversation as a string to feed to an LLM
const conversationText = conversation.toString();
// Output:
// Client: I need help with my account
// System: Ask for account details
```

## Methods

### setAgentName()

```ts
setAgentName(name): void;
```

Sets the name of the AI agent in the conversation to be used in [toString](#tostring).

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `name` | `string` | The name to set for the agent. |

#### Returns

`void`

***

### setUserName()

```ts
setUserName(name): void;
```

Sets the name of the user in the conversation to be used in [toString](#tostring).

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `name` | `string` | The name to set for the user. |

#### Returns

`void`

## Properties

### addDirective()

```ts
addDirective: (message) => void;
```

Adds a directive message to the conversation.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `message` | `string` | The directive message to add. |

#### Returns

`void`

#### Example

```
// Add a directive to guide the LLM response
conversation.addDirective("Ask the user for their preferred date and time for the reservation");

// The resulting conversation string might look like:
// User: I'd like to book a table at your restaurant.
// System: Ask the user for their preferred date and time for the reservation
```

***

### addMessage()

```ts
addMessage: (name, message) => void;
```

Adds a message from a specified sender to the conversation.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `name` | `"user"` \| `"agent"` \| `"system"` | The sender of the message. |
| `message` | `string` | The content of the message. |

#### Returns

`void`

***

### getHistory()

```ts
getHistory: () => Message[];
```

Gets the history of all messages in the conversation.

#### Returns

[`Message`](Message.md)[]

An array of Message objects representing the conversation history.

***

### getProposedReply()

```ts
getProposedReply: () => null | string;
```

Gets the current proposed reply message.

#### Returns

`null` \| `string`

The proposed reply message, or null if none exists.

***

### setDirectiveFormatter()

```ts
setDirectiveFormatter: (formatter) => void;
```

Sets a custom formatter for directive messages.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `formatter` | (`message`) => `string` | A function that takes a Message and returns a formatted string. |

#### Returns

`void`

***

### setProposedMessageFormatter()

```ts
setProposedMessageFormatter: (formatter) => void;
```

Sets a custom formatter for proposed messages.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `formatter` | (`message`) => `string` | A function that takes a message string and returns a formatted string. |

#### Returns

`void`

***

### setProposedReply()

```ts
setProposedReply: (message) => void;
```

Sets a proposed reply message.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `message` | `string` | The proposed reply message. |

#### Returns

`void`

***

### toString()

```ts
toString: (ignoreDirectives?) => string;
```

Converts the conversation to a string representation to be fed to an LLM.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `ignoreDirectives`? | `boolean` | Whether to ignore directives in the string output. |

#### Returns

`string`

The string representation of the conversation.
