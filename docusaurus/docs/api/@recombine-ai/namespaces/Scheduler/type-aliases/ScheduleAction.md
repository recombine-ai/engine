# ScheduleAction()

```ts
type ScheduleAction = (delay, phone) => Promise<void>;
```

A function that schedules an action to be executed in the future

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `delay` | `Date` | – a date when the action should be executed use [delayFactory](../../../../functions/delayFactory.md) to create a date |
| `phone` | `string` | – user's phone |

## Returns

`Promise`\<`void`\>
