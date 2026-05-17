---
name: add-ipc
description: Add a new IPC channel exposed from main to renderer. Walks through naming → shared types → main handler → preload bridge → renderer hook. Use when the user asks to "add an IPC", "wire a new main-process function to the UI", or describes a renderer-driven action that needs a privileged op.
---

# add-ipc

The IPC surface lives behind a single bridge in `src/preload/index.ts`. Renderer never gets `ipcRenderer.invoke` directly — only the typed methods exposed by `contextBridge`.

## Steps

1. **Name the channel.** Add to `src/shared/ipc-channels.ts`:

   ```ts
   export const IPC = {
     ...
     MyNewAction: 'my-new-action',
   } as const;
   ```

   Names use kebab-case. They're string literals; main and renderer compare them as identity.

2. **Define request/response types.** Add to `src/shared/types.ts` so both processes see the same shape:

   ```ts
   export interface MyNewActionInput {
     pageId: string;
     dryRun?: boolean;
   }
   export interface MyNewActionResult {
     ok: boolean;
     affected: number;
   }
   ```

3. **Implement the handler.** In `src/main/ipc.ts`, inside `registerIpc()`:

   ```ts
   handle(IPC.MyNewAction, async (input: MyNewActionInput): Promise<MyNewActionResult> => {
     // ... use services from @main/services, never @main/store directly
     return { ok: true, affected: 0 };
   });
   ```

   The `handle()` wrapper already serializes errors via `toSerializedError` so the renderer always gets `{ ok, data | error }`. Don't try/catch unless you need a different shape.

4. **Expose on the bridge.** In `src/preload/index.ts`, add it under the right namespace (`pages`, `audit`, `dialog`, etc.) using the existing `invoke<T>` helper, which already unwraps `{ ok, data | error }` into either `T` or a thrown `LoopbridgeApiError`:

   ```ts
   pages: {
     ...
     myNewAction: (input: MyNewActionInput): Promise<MyNewActionResult> =>
       invoke(IPC.MyNewAction, input),
   },
   ```

5. **Consume from the renderer.** Call it through the typed `api` proxy from `src/renderer/src/lib/ipc.ts` inside a TanStack Query mutation — no wrapper hook directory:

   ```ts
   const m = useMutation({
     mutationFn: (input: MyNewActionInput) => api.pages.myNewAction(input),
     onError: (err) => setError(err),
   });
   ```

## Patterns to reuse

- **Audit invalidation is event-driven.** When your handler calls `transition()` from `@main/services/progress-service`, it auto-emits `IPC.EvtMigrationStatus`. `App.tsx` listens once and invalidates `['audit-list']`. You do **not** need a manual `queryClient.invalidateQueries(['audit-list'])` in the renderer.
- **Need a save/open file path from the user?** Don't expose `fs` to renderer. Call `api.dialog.showSaveDialog({ filters, defaultPath })` first, then pass the chosen path back through your IPC. Mirror `IPC.DialogShowSaveDialog` in `src/main/ipc.ts` for the open-dialog case if you add one.
- **Long-running fan-out of HTTP requests?** Use `pLimit` from `@main/net/concurrency` with `getConfig().network.maxConcurrentRequests`. See `fetchAndCachePage` in `src/main/services/migration-service.ts`.
- **Storing structured request/response details in the audit log?** `recordEvent`/`transitionPage` already redact common secret-bearing keys (`authorization`, `token`, `*-token`, `password`, `cookie`, `x-api-key`, etc.). Don't strip yourself before passing — the redactor walks the object recursively.

## Don'ts

- Don't import `@main/store/*` directly from `ipc.ts`. Go through a service. Keeps the store boundary clean.
- Don't return non-serializable values (functions, class instances). The IPC bridge JSON-serializes; methods will be dropped.
- Don't add an `any` to the bridge. The whole point of the layer is type-safe IPC.
- Don't reach `window.api` in tests. Mock at the service layer instead.

## After

Run `npm run typecheck && npm run lint -- --max-warnings 0` — both will fail loudly if you forgot any of the four touchpoints.
