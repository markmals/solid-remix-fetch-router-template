# Contributor Guide

## Project Commands

To see all commands available, run `mise tasks`.

- **Install:** `mise install`
- **Dev server:** `mise run dev` → [http://localhost:1612](http://localhost:1612)
- **Build:** `mise run build`
- **Preview build:** `mise run preview`
- **Format:** `mise run fmt`
- **Typecheck:** `mise run typecheck`

> Note: Node & pnpm are managed via **Mise** (`mise.toml`).

## Project overview

- **Framework:** Single-page web application with `solid-js`, `@solidjs/router`, and `@solidjs/meta`
- **Transport:** `@remix-run/fetch-router` (server-style routing primitives, used inside a Service Worker)
- **Service Worker:** intercepts same-origin `/api/*` requests and delegates to a `fetch-router` instance
- **Bundler:** Vite (Rolldown), multi-entry for `index.html` and the worker

Directory highlights:

```
app/
  components/        UI components
  data/              Queries (GET) and Actions (mutations)
  lib/               Shared utilities (middleware, fetch-client, hooks)
  routes/            Solid route components (root/index/show/edit/etc.)
  worker/            Service Worker handlers + data layer
  app.ts             UI route definitions
  api.ts             API route definitions
  routes.ts          Solid Router configuration + preloads
  entry.client.tsx   Client bootstrap + service worker registration
entry.worker.ts      Service Worker bootstrap (intercepts /api)
index.html           SPA shell + client entry
vite.config.ts       Multi-entry build config (main + worker)
tsconfig.json        Strict TS, bundler resolution, ~/* alias
```

## How the pieces fit together

### 1) UI routing (client)

- `app/app.ts` declares **URL patterns** via `createRoutes`.
- `app/routes.ts` wires patterns into **Solid Router** `RouteDefinition[]`, including `preload` hooks that call queries.
- `app/entry.client.tsx` uses `WorkerRegistry` to register service worker and mount `<Router>` + `<MetaProvider>` to `document.body`.

### 2) API routing (Service Worker)

- `entry.worker.ts` installs/activates the service worker with lifecycle events (`install` → `skipWaiting()`, `activate` → `clients.claim()`) and **only** handles **same-origin** requests with path starting `/api/`.
- `entry.worker.ts` creates a `fetch-router` with middleware:
    - `formData()` to parse bodies
    - `methodOverride()` for RESTful forms
    - `clientRedirect()` transforms server redirects into `200` + `X-Redirect` header (for client navigations)
    - `logger()` in dev
- `app/api.ts` defines **typed API routes** with `createRoutes`/`resources` (RESTful patterns under `/api`).
- `app/worker/handlers.ts` exports handlers that map API routes to functions, using `satisfies RouteHandlers<typeof api>` for type safety. Handlers respond with `json()` or `redirect()`.

### 3) Data layer (client)

- `app/lib/fetch-client.ts` provides `createClient()` that enhances route objects with a `fetch()` helper:
    - Automatically builds `href` from `pattern` + params + search
    - Sends JSON/FormData/URLSearchParams appropriately
    - **Reads `X-Redirect`** and triggers a SPA redirect
    - Parses JSON responses (falls back to text)
    - Exposes a stable `key` for cache/query identification
- `app/data/queries.ts` exports a `queries` object with methods that wrap GET endpoints using Solid Router's `query()` for caching + suspense (`createAsync`). Also exports the API `client` instance created via `createClient(api)`.
- `app/data/actions.ts` exports an `actions` object with methods that wrap mutations via `formAction()`:
    - All mutations POST to the API and use **method override** by setting `_method` on the `FormData` when needed.

## Code style & conventions

- **Aliases:** `~/*` → `./app/*`
- **Imports:** Append `.ts`/`.tsx` extensions when importing local files
- **Formatting:** Use Prettier (run `mise run fmt`). VS Code settings enforce Prettier on save.
- **Testing:** No test suite in this repo. Agents should **typecheck** before completing tasks.

## Debugging

- **NEVER** try to run the development server (`mise run dev`) yourself
- **ONLY** run the build command (`mise run build`) if you need to verify the build output
- For debugging, insert `console.log` statements throughout the code
- Ask the user to run the development server themselves, perform the action causing the bug/issue, and paste the logs from their browser (or build) console back in the chat window for you to diagnose

## Service Worker specifics

- **Scope:** only same-origin `/api/*` requests are handled (`entry.worker.ts` checks both).
- **Build artifact:** Vite emits `entry.worker.js`. Client registers either `/entry.worker.ts` in dev or `/entry.worker.js` in prod (see `app/entry.client.tsx`).
- **Redirect bridge:** Server redirects are transformed to `200` with `X-Redirect` by `clientRedirect()` middleware; the client fetch helper translates that to SPA navigation.

**Guardrails for agents**

- Keep `METHOD_KEY` (`"_method"`) and `REDIRECT_KEY` (`"X-Redirect"`) consistent between worker middleware and client helpers. Change the constants themselves and everything should stay in sync.
- Do not intercept non-API or cross-origin requests in the service worker.
- If you change worker paths or output names, update both `vite.config.ts` (multi-entry) and `app/entry.client.tsx` registration logic.

## Build & dev details

- **Port:** `1612` (see `vite.config.ts`)
- **Multi-entry build:** outputs:
    - main app from `index.html`
    - worker from `entry.worker.ts` → `entry.worker.js`
- **Experimental Vite Rolldown:** `"vite": "npm:rolldown-vite@latest"` via `pnpm.overrides`
- **TypeScript:** DOM + WebWorker libs enabled; paths via `~/*`

## Quality bar before finishing a task

1. `mise run fmt` (or run Prettier in your editor)
2. `mise run typecheck`
3. `mise run build` **ONLY if relevant**

## Glossary

- **App routes:** Human-facing paths in `app/app.ts`, rendered by Solid
- **API routes:** Machine endpoints in `app/api.ts`, handled by the service worker `fetch-router`
- **Query:** A cached GET wrapper created with `query()` for suspense + deduplication
- **Action:** A mutation wrapper created with `formAction()` that POSTs and uses `_method` when needed
- **Client:** Enhanced route object created via `createClient(api)` that provides typed `fetch()` methods
- **Handlers:** Route handler functions in `app/worker/handlers.ts` that process API requests

## Notes for agents integrating with tools

- This repository has **no** CI config or unit tests; rely on **format**, **typecheck**, and **build** as the acceptance checks.
- If tests are added later, document how to run them here and add a task in `mise.toml`.

# App Architecture Patterns

## Navigation via `<form method="get">` (button → client-side navigation)

Use GET forms anywhere you want a button to behave like a link. The root layout intercepts GET form submissions and converts them to SPA navigations via the `useInstallGlobalNavigation()` hook.

### How it works

- Call `useInstallGlobalNavigation()` in your root component to set up the global navigation handler.
- The hook uses `@remix-run/interaction`'s `on()` helper to listen for document `submit` events.
- Wrap buttons in `<form method="get">` with an `action` built from `app.*.href()`.

```tsx
// app/lib/use-install-global-nav.ts
import { on } from "@remix-run/interaction";
import { useNavigate } from "@solidjs/router";

export function useInstallGlobalNavigation() {
    const navigate = useNavigate();

    on(document, {
        submit(event) {
            if (!(event.target instanceof HTMLFormElement)) return;
            if (event.target.method.toUpperCase() === "POST") return;
            if (event.defaultPrevented) return;

            event.preventDefault();
            navigate(new URL(event.target.action).pathname);
        },
    });
}
```

```tsx
// app/routes/root.tsx (excerpt)
import { useInstallGlobalNavigation } from "~/lib/use-install-global-nav.ts";

export default function Root(props: ParentProps) {
    useInstallGlobalNavigation();
    // ...
}
```

```tsx
// example usage in a route
<form action={app.contact.edit.href({ contactId: contact().id })} method="get">
    <button type="submit">Edit</button>
</form>
```

### Notes

- Always build URLs with `app.*.href(...)`.
- Use `on()` from `@remix-run/interaction` for declarative event handling with automatic cleanup.

## Mutations: route everything through `formAction`, `<form method="post">`, and RESTful endpoints

All writes go through Solid Router `action()` wrappers produced by `formAction()` and target `fetch-router` endpoints. Non-POST verbs are emulated with method override. Server handlers either **redirect** to revalidate and navigate, or return `new Response(null)` for updates which shouldn't or don't need to change location when the update completes.

### Client

```ts
// app/data/actions.ts
export const actions = {
    create: formAction(api.contact.create), // POST
    update: formAction(api.contact.update), // PUT (via _method)
    favorite: formAction(api.contact.favorite), // PUT (via _method)
    destroy: formAction(api.contact.destroy), // DELETE (via _method)
};
```

```tsx
// usage in UI
<form action={actions.update.with({ contactId: contact().id })} method="post"> … </form>
<form action={actions.destroy.with({ contactId: contact().id })} method="post"> … </form>
<form action={actions.favorite.with({ contactId: contact().id })} method="post"> … </form>
```

### Server (Service Worker)

```ts
// app/worker/handlers.ts
import { RouteHandlers } from "@remix-run/fetch-router";
import { json, redirect } from "@remix-run/fetch-router/response-helpers";
import { api } from "~/api";
import { app } from "~/app";

export const handlers = {
    contact: {
        update: async ({ params, formData }) => {
            const contact = await updateContact(params.contactId, {
                /* read fields */
            });
            return redirect(app.contact.show.href({ contactId: contact.id })); // revalidate via redirect
        },
        destroy: async ({ params }) => {
            await deleteContact(params.contactId);
            return redirect(app.index.href());
        },
        favorite: async ({ params, formData }) => {
            await updateContact(params.contactId, {
                favorite: formData.get("favorite") === "true",
            });
            return new Response(null); // don't need to navigate anywhere once this update completes
        },
    },
} satisfies RouteHandlers<typeof api>;
```

```ts
// entry.worker.ts (excerpt)
import { handlers } from "~/worker/handlers.ts";

router.map(api, handlers);
```

### Why

- `formAction()` automatically adds `_method` when the server route is not POST.
- Redirect responses are converted into an `X-Redirect` header by middleware and honored by the client fetch helper, producing SPA navigations and cache-safe revalidation.

## Preload queries for routes that call `createAsync()`

Use Solid Router `preload` to warm the data cache for any route (or child route) that will call `createAsync()`.

```ts
// app/routes.ts
import { queries } from "~/data/queries.ts";

export const routes: RouteDefinition[] = [
    {
        path: app.root.pattern.toString(),
        preload: ({ location }) => queries.list(location.query.q as string),
        component: lazy(() => import("~/routes/root.tsx")),
        children: [
            {
                path: app.contact.show.pattern.toString(),
                preload: ({ params }) => queries.show(params.contactId),
                component: lazy(() => import("~/routes/show-contact.tsx")),
            },
            {
                path: app.contact.edit.pattern.toString(),
                preload: ({ params }) => queries.show(params.contactId),
                component: lazy(() => import("~/routes/edit-contact.tsx")),
            },
        ],
    },
];
```

```ts
// app/data/queries.ts
export const client = createClient(api);

export const queries = {
    list: query(
        (q?: string) => client.contact.list.fetch<ContactRecord[]>({ search: { q: q ?? "" } }),
        client.contact.list.key,
    ),
    show: query(
        (id: string) => client.contact.show.fetch<ContactRecord>({ path: { contactId: id } }),
        client.contact.show.key,
    ),
};
```

### Guidelines

- Preload at the **nearest** route that needs the data.
- For queries that depend on path params or search params, pass them through in `preload`.

## Search UX with `useSearchParams()` and `<input onInput>`

Drive live-search via query params; keep navigation light with `replace: !first`.

```tsx
// app/components/SearchBar.tsx
export function SearchBar() {
    const [searchParams, setSearchParams] = useSearchParams();
    const query = () => searchParams.q as string | undefined;
    const isRouting = useIsRouting();
    const isSearching = () => isRouting() && query();

    return (
        <form action={app.index.href()} id="search-form" method="get">
            <input
                aria-label="Search contacts"
                classList={{ loading: isSearching() }}
                value={query() ?? ""}
                name="q"
                onInput={e => {
                    const first = query() === undefined;
                    setSearchParams({ q: e.currentTarget.value || undefined }, { replace: !first });
                }}
                placeholder="Search"
                type="search"
            />
            <div aria-hidden hidden={!isSearching()} id="search-spinner" />
            <div aria-live="polite" class="sr-only" />
        </form>
    );
}
```

### Notes

- Avoid submitting the form; rely on `onInput` + `setSearchParams()` for instant feedback.
- Use `replace` to prevent history spam after the first entry.

## Optimistic UI with `useSubmission()`

Mirror pending form state locally by watching the submission that matches your action and params.

```tsx
// app/components/Favorite.tsx
import { actions } from "~/data/actions.ts";

export function Favorite(props: { favorite: boolean; id: string }) {
    const submission = useSubmission(actions.favorite, ([{ contactId }]) => contactId === props.id);
    const favorite = () =>
        submission.pending ? submission.input?.[1].get("favorite") === "true" : props.favorite;

    return (
        <form action={actions.favorite.with({ contactId: props.id })} method="post">
            <button
                aria-label={favorite() ? "Remove from favorites" : "Add to favorites"}
                name="favorite"
                value={favorite() ? "false" : "true"}
                type="submit"
            >
                {favorite() ? "★" : "☆"}
            </button>
        </form>
    );
}
```

### Pattern

- Filter `useSubmission` to the specific resource (e.g., by `contactId`).
- Read the pending form data to reflect the new state immediately.
- Pair with a server handler.

## Global pending UI with `useIsRouting()`

Apply a "loading" affordance anywhere in the app while navigations or data loads are in flight.

```tsx
const isRouting = useIsRouting();

<div classList={{ loading: isRouting() }}>{props.children}</div>;
```

### Tip

- Wrap the layout with `<Suspense fallback={<p class="loading">Loading...</p>}>` for the initial fetch.

---

## Localized pending UI

For link-level or control-level feedback, scope pending styles to the specific target.

```tsx
// Global state

const [pendingHref, setPendingHref] = createSignal("");

// In the component

const isPending = () => isRouting() && pendingHref() === link();

<A classList={{ pending: isPending() }} href={link()} onClick={() => setPendingHref(link())}>
    {/* ... */}
</A>;
```

```tsx
const isSearching = () => Boolean(isRouting() && query());

<input classList={{ loading: isSearching() }} ... />
<div aria-hidden hidden={!isSearching()} id="search-spinner" />
```

### Guidelines

- Use a global signal to tag the specific link/action being triggered.
- Pair with `useIsRouting()` to gate the visual state.

## Always use route builders from `createRoutes()`

Do not hardcode paths. Use strongly-typed builders for **both** application and API routes:

```ts
// App paths
app.contact.show.href({ contactId: id }); // "/contact/:contactId"
app.index.href(); // "/"

// API calls via enhanced client
client.contact.list.fetch({ search: { q: "…" } });
client.contact.show.fetch({ path: { contactId: id } });
```

### Why

- Centralizes patterns/params, prevents drift.
- Provides stable `key`s used to cache queries:
    ```ts
    query(fn, client.contact.list.key);
    ```

## Redirect & navigation handshake (service worker ↔︎ client)

Server handlers should return `redirect(...)` whenever mutation implies navigation. The Service Worker converts redirects into a header that the client respects.

```ts
// app/lib/middleware.ts
export const REDIRECT_KEY = "X-Redirect";
export function clientRedirect(): Middleware {
    return async (_, next) => {
        const response = await next();
        if (response.status >= 300 && response.status < 400) {
            return new Response(null, {
                status: 200,
                headers: { [REDIRECT_KEY]: response.headers.get("Location")! },
            });
        }
        return response;
    };
}
```

```ts
// app/lib/fetch-client.ts (excerpt)
const location = response.headers.get(REDIRECT_KEY);
if (location) throw redirect(location); // @solidjs/router redirect (SPA)
```

### Rule of thumb

- Use `redirect(...)` after creates/updates/destroys that should take the user to a canonical route.
- Use `new Response(null)` for inline state toggles where the route doesn't need to change, even if the user navigates away before the mutation completes.

## Method override (non-POST forms)

All mutation forms are `<form method="post">`. `formAction()` adds `_method` when the server expects PUT/DELETE/... so the middleware can upgrade the method.

```ts
// app/lib/middleware.ts
export const METHOD_KEY = "_method";
export const methodOverride = () => _methodOverride({ fieldName: METHOD_KEY });
```

```ts
// app/lib/form-action.ts (excerpt)
if (route.method !== "POST") {
    data.set(METHOD_KEY, route.method); // server upgrades it
}
```

**Keep the keys in sync** if you change them.

## Service Worker API boundary

`entry.worker.ts` only intercepts **same-origin** `/api/*` requests.

```ts
const url = new URL(event.request.url);
const sameOrigin = url.origin === location.origin;
const maybeApi = url.pathname.startservice workerith("/api/");
if (!sameOrigin || !maybeApi) return;

event.respondWith(router.fetch(event.request));
```

### Implication

- Asset and page navigations are left to the browser.
- Only your API is virtualized by the worker.

## Suspense-first layout

Top-level UI is wrapped in `<Suspense>` so route preloads and queries render a lightweight global skeleton.

```tsx
<Suspense fallback={<p class="loading">Loading...</p>}>
    <div id="sidebar">…</div>
    <div id="detail">{props.children}</div>
</Suspense>
```

## Event-based service worker registration with `WorkerRegistry`

Use the `WorkerRegistry` class to encapsulate service worker registration logic with typed events and automatic reload handling.

```tsx
// app/entry.client.tsx
import { on } from "@remix-run/interaction";
import { WorkerRegistry } from "./lib/worker-registry.ts";

const registry = new WorkerRegistry();

on(registry, {
    registered() {
        render(
            () => (
                <MetaProvider>
                    <Router>{routes}</Router>
                </MetaProvider>
            ),
            document.body,
        );
    },
});

await registry.register();
```

```ts
// app/lib/worker-registry.ts
import { TypedEventTarget } from "./typed-event-target.ts";

export class WorkerRegistry extends TypedEventTarget<RegistryEventMap> {
    async register() {
        if (!navigator.serviceWorker.controller) {
            await navigator.serviceWorker.register(this.#entry, { type: "module" });
            window.location.reload(); // Reload to activate the worker
        } else {
            this.dispatchEvent(new RegistryEvent("registered"));
        }
    }
}
```

### Why

- Encapsulates the "register → reload if needed → render" flow
- Uses typed events for coordination between registration and rendering
- Automatically handles the development vs production worker paths

## `createAsync()` wrapper with noop proxy

Use a custom `createAsync()` wrapper that provides a noop proxy as the initial value to prevent errors when accessing properties before data loads.

```ts
// app/lib/create-async.ts
import { createAsync as _createAsync } from "@solidjs/router";

export function createAsync<T>(fetcher: () => Promise<T>): Accessor<T> {
    return _createAsync(fetcher, { initialValue: makeNoopProxy() });
}
```

### How it works

- The noop proxy returns empty strings, zeros, or empty arrays for any property access
- Prevents `Cannot read property 'x' of undefined` errors during initial render
- Implements `Symbol.toPrimitive` for safe coercion in JSX
- Returns `undefined` for the `then` property to prevent being treated as a Promise

### Usage

```tsx
// Instead of needing optional chaining everywhere
const contact = createAsync(() => queries.show(params.contactId));

// You can safely access properties directly
<h1>
    {contact().first} {contact().last}
</h1>;

// The noop proxy ensures these don't error before data loads
```

## Declarative event handling with `on()` from `@remix-run/interaction`

Use `on()` for type-safe, declarative event handling with automatic cleanup.

```ts
import { on } from "@remix-run/interaction";

// Document events
on(document, signal, {
    submit(event) {
        // handle submit
    },
    keydown(event) {
        // handle keydown
    },
});

// Custom event targets with TypedEventTarget
on(registry, signal, {
    registered() {
        // handle custom event
    },
});
```

### Benefits

- Automatically handles event listener cleanup when an AbortSignal is passed
- Type-safe event handlers
- Cleaner than manual `addEventListener`/`removeEventListener`
- Works with both standard and custom events

## Object-based exports for queries and actions

Export queries and actions as objects rather than individual named exports for clarity and organization.

```ts
// app/data/queries.ts
export const queries = {
    list: query(/* ... */),
    show: query(/* ... */),
};

// app/data/actions.ts
export const actions = {
    create: formAction(/* ... */),
    update: formAction(/* ... */),
    destroy: formAction(/* ... */),
    favorite: formAction(/* ... */),
};
```

### Why

- Clearer distinction between queries and actions at import sites
- Easier to see all available queries/actions in one place
- Better autocomplete experience
- Consistent naming pattern

## Handler type safety with `satisfies RouteHandlers<typeof api>`

Use the `satisfies` operator to ensure handlers match API route structure while preserving inference.

```ts
// app/worker/handlers.ts
import { RouteHandlers } from "@remix-run/fetch-router";
import { api } from "~/api";

export const handlers = {
    contact: {
        list: async ({ url }) => {
            /* ... */
        },
        show: async ({ params }) => {
            /* ... */
        },
        create: async () => {
            /* ... */
        },
        update: async ({ params, formData }) => {
            /* ... */
        },
        destroy: async ({ params }) => {
            /* ... */
        },
        favorite: async ({ params, formData }) => {
            /* ... */
        },
    },
} satisfies RouteHandlers<typeof api>;
```

### Benefits

- Type errors if handlers don't match API route definitions
- Full type inference for params, formData, url
- Prevents typos and missing handlers
- Documents the relationship between handlers and API routes

## Acceptance checklist for changes to these patterns

- All navigations use `app.*.href(...)` or API fetch via enhanced client
- Mutations go through `formAction()` and server endpoints in the service worker router
- Redirects are used appropriately; optimistic toggles return `new Response(null)`
- Queries are preloaded with `preload` and consumed with `createAsync()`
- Pending UI present globally (`useIsRouting()`) and locally as needed
- All non-JSX event handlers use `on()` from `@remix-run/interaction`
- Service worker registration uses `WorkerRegistry` with event-based coordination
- Handlers use `satisfies RouteHandlers<typeof api.*>` for type safety
- Build/typecheck succeed; demo latency still reveals loading states
