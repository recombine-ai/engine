# Message

Represents a message in a conversation between a user and an agent, or a system message.
Messages can contain text and optionally an image URL. To be used in the [Conversation](Conversation.md) interface.

## Properties

### imageUrl?

```ts
optional imageUrl: string;
```

Optional URL of an image associated with the message

***

### sender

```ts
sender: "user" | "agent" | "system";
```

The sender of the message, which can be one of the following: 'user', 'agent', or 'system'

***

### text

```ts
text: string;
```

The text content of the message
