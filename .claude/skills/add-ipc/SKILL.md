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

4. **Expose on the bridge.** In `src/preload/index.ts`:

   ```ts
   myNewAction: (input: MyNewActionInput) =>
     ipcRenderer.invoke(IPC.MyNewAction, input) as Promise<ApiResult<MyNewActionResult>>,
   ```

5. **Consume from the renderer.** Add a TanStack Query hook (mirror the existing `src/renderer/hooks/`):

   ```ts
   export function useMyNewAction() {
     return useMutation({
       mutationFn: (input: MyNewActionInput) => unwrap(window.api.myNewAction(input)),
     });
   }
   ```

   `unwrap()` (or whatever the repo uses) lifts `{ ok, data }` to either `data` or a thrown `LoopbridgeApiError` — keeps React Query happy.

## Don'ts

- Don't import `@main/store/*` directly from `ipc.ts`. Go through a service. Keeps the store boundary clean.
- Don't return non-serializable values (functions, class instances). The IPC bridge JSON-serializes; methods will be dropped.
- Don't add an `any` to the bridge. The whole point of the layer is type-safe IPC.
- Don't reach `window.api` in tests. Mock at the service layer instead.

## After

Run `npm run typecheck && npm run lint -- --max-warnings 0` — both will fail loudly if you forgot any of the four touchpoints.
