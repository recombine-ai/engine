# EngineConfig

Configuration options for the Engine.

## Properties

### basePath?

```ts
optional basePath: string;
```

Optional base URL path for resolving paths to prompts.

***

### logger?

```ts
optional logger: Logger;
```

Optional logger instance for handling log messages.

***

### sendAction?

```ts
optional sendAction: SendAction;
```

Optional function for sending actions.

***

### tokenStorage?

```ts
optional tokenStorage: object;
```

Optional token storage object that provides access to authentication tokens.

#### getToken()

```ts
getToken: () => Promise<null | string>;
```

##### Returns

`Promise`\<`null` \| `string`\>
