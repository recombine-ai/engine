# LLMStep

## Properties

### context?

```ts
optional context: Record<string, unknown>;
```

Additional data to be inserted into the prompt. Accessible via Nunjucks variables.

#### Example

```
prompt: "Hello {{ name }}, your score is {{ score }}"
context: { name: "John", score: 42 }
```

***

### execute()

```ts
execute: (reply) => Promise<unknown>;
```

Function to execute with the LLM's response. Use setProposedReply to use the LLM's output as the proposed reply.
Or use combination of getProposedReply and setProposedReply to substitute parts of the string.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `reply` | `string` |

#### Returns

`Promise`\<`unknown`\>

#### Example

```
// Use LLM output directly as reply
execute: (reply) => messages.setProposedReply(reply)

// Substitute tokens in LLM output
execute: (reply) => {
  const withLink = reply.replace('<PAYMENT_LINK>', 'https://payment.example.com/123')
  messages.setProposedReply(withLink)
}
```

***

### ignoreDirectives?

```ts
optional ignoreDirectives: boolean;
```

Exclude directives from message history passed to the LLM for this step

***

### maxAttempts?

```ts
optional maxAttempts: number;
```

When provided, throws an error if the step is invoked more times than `maxAttempts`.
Number of attempts taken is reset when `shouldExecute` returns `false`. Useful to limit
rewinds by reviewers. NOTE that it doesn't work on steps without `shouldExecute` method.

***

### model?

```ts
optional model: BasicModel;
```

LLM to use. Defaults to gpt-4o

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

Error handler called if an error occurred during LLM API call or in `execute` function

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `error` | `string` |

#### Returns

`Promise`\<`unknown`\>

***

### prompt

```ts
prompt: string | File;
```

Prompt can be a simple string or a link to a file, loaded with `loadFile` function which
takes a path to the file relative to `src/use-cases` directory. Should be Nunjucks-compatible.

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

***

### schema?

```ts
optional schema: ZodType<any, ZodTypeDef, any>;
```

Schema for structured LLM output using zod https://zod.dev/
library.

***

### ~~shouldExecute()?~~

```ts
optional shouldExecute: (reply) => boolean | Promise<boolean>;
```

Check a condition, whether the `execute` function should run or not

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `reply` | `string` |

#### Returns

`boolean` \| `Promise`\<`boolean`\>

#### Deprecated

use `runIf` to check if the step should be run, use if in `execute` to check
if it should be executed
