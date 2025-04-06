# makeAction()

```ts
function makeAction(
   sendAction, 
   type, 
message): (state) => Promise<void>;
```

## Parameters

| Parameter | Type |
| ------ | ------ |
| `sendAction` | `undefined` \| [`SendAction`](../type-aliases/SendAction.md) |
| `type` | `string` |
| `message` | `string` |

## Returns

```ts
(state): Promise<void>;
```

### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `state` | `"started"` \| `"completed"` \| `"failed"` | `'completed'` |

### Returns

`Promise`\<`void`\>
