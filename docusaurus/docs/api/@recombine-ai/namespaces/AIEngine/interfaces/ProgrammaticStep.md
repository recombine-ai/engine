# ProgrammaticStep

## Properties

### execute()

```ts
execute: () => Promise<unknown>;
```

Content of the step

#### Returns

`Promise`\<`unknown`\>

***

### name

```ts
name: string;
```

Step name for debugging

***

### onError()

```ts
onError: (error) => Promise<unknown>;
```

Error handler called if an error occurred during in `execute` function

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `error` | `string` |

#### Returns

`Promise`\<`unknown`\>

***

### runIf()?

```ts
optional runIf: (messages) => boolean | Promise<boolean>;
```

Determines if the step should be run or not

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `messages` | [`Conversation`](Conversation.md) |

#### Returns

`boolean` \| `Promise`\<`boolean`\>
