# createAIEngine()

```ts
function createAIEngine(cfg): object;
```

## Parameters

| Parameter | Type |
| ------ | ------ |
| `cfg` | `EngineConfig` |

## Returns

`object`

### createStep()

```ts
createStep: <T>(step) => T;
```

#### Type Parameters

| Type Parameter |
| ------ |
| `T` *extends* `BasicStep` \| `Step` |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `step` | `T` |

#### Returns

`T`

### createWorkflow()

```ts
createWorkflow: (...steps) => Promise<{
  rewindTo: (step) => void;
  run: (messages) => Promise<null | string>;
  terminate: () => void;
  beforeEach: void;
}>;
```

#### Parameters

| Parameter | Type |
| ------ | ------ |
| ...`steps` | (`BasicStep` \| `Step`)[] |

#### Returns

`Promise`\<\{
  `rewindTo`: (`step`) => `void`;
  `run`: (`messages`) => `Promise`\<`null` \| `string`\>;
  `terminate`: () => `void`;
  `beforeEach`: `void`;
\}\>

### loadFile()

```ts
loadFile: (path) => object;
```

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `path` | `string` |

#### Returns

`object`

##### content()

```ts
content: () => Promise<string>;
```

###### Returns

`Promise`\<`string`\>

### makeMessagesList()

```ts
makeMessagesList: (messages) => Messages;
```

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `messages` | [`Message`](../interfaces/Message.md)[] | `[]` |

#### Returns

`Messages`
