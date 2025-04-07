# delayFactory()

```ts
function delayFactory(schedule): (delay) => Date;
```

## Parameters

| Parameter | Type |
| ------ | ------ |
| `schedule` | [`Schedule`](../interfaces/Schedule.md) |

## Returns

getNextTimePoint function that makes a date from a given Delay
- note that Delay must not be negative

```ts
(delay): Date;
```

### Parameters

| Parameter | Type |
| ------ | ------ |
| `delay` | `Delay` |

### Returns

`Date`
