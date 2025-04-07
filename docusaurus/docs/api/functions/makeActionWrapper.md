# makeActionWrapper()

```ts
function makeActionWrapper(sendAction): (message, type, action) => Promise<void>;
```

## Parameters

| Parameter | Type |
| ------ | ------ |
| `sendAction` | [`SendAction`](../type-aliases/SendAction.md) |

## Returns

```ts
(
   message, 
   type, 
action): Promise<void>;
```

### Parameters

| Parameter | Type |
| ------ | ------ |
| `message` | `string` |
| `type` | `string` |
| `action` | () => `Promise`\<`unknown`\> |

### Returns

`Promise`\<`void`\>
