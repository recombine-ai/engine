# createMock()

```ts
function createMock<T>(
   logger, 
   constructor, 
overrides?): InstanceType<T>;
```

## Type Parameters

| Type Parameter |
| ------ |
| `T` *extends* `ConstructorType`\<`any`\> |

## Parameters

| Parameter | Type |
| ------ | ------ |
| `logger` | [`Logger`](../interfaces/Logger.md) |
| `constructor` | `T` |
| `overrides`? | `Partial`\<`InstanceType`\<`T`\>\> |

## Returns

`InstanceType`\<`T`\>
