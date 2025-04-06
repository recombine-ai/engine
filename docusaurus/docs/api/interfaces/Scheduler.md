# Scheduler

## Properties

### clearAllPendingActions()

```ts
clearAllPendingActions: (phone) => Promise<unknown>;
```

Removes all actions for the given phone that were not executed yet.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `phone` | `string` |

#### Returns

`Promise`\<`unknown`\>

***

### registerAction()

```ts
registerAction: (actionName, action) => ScheduleAction;
```

Register a delayed action handler.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `actionName` | `string` | – a unique (inside one use-case) name for the action |
| `action` | (`phone`) => `Promise`\<`unknown`\> | – a function that will be called when the action is triggered |

#### Returns

`ScheduleAction`

a function to schedule the action
