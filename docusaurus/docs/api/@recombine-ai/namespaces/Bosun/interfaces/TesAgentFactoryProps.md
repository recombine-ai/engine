# TesAgentFactoryProps\<CTX\>

## Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `CTX` *extends* `DefaultContext` | `DefaultContext` |

## Properties

### ai

```ts
ai: AIEngine;
```

***

### ctx

```ts
ctx: Public<Context<CTX>>;
```

***

### getMessages()

```ts
getMessages: () => Message[];
```

#### Returns

[`Message`](../../AIEngine/interfaces/Message.md)[]

***

### logger

```ts
logger: Logger;
```

***

### scheduler

```ts
scheduler: Scheduler;
```

***

### sendAction

```ts
sendAction: SendAction;
```

***

### sendMessage()

```ts
sendMessage: (message) => Promise<void>;
```

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |

#### Returns

`Promise`\<`void`\>
