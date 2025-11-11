import { createRouter } from "@remix-run/fetch-router";
import { formData } from "@remix-run/fetch-router/form-data-middleware";
import { logger } from "@remix-run/fetch-router/logger-middleware";
import { on, TypedEventTarget } from "@remix-run/interaction";
import { api } from "~/api.ts";
import { clientRedirect, methodOverride } from "~/lib/server-middleware.ts";
import { handlers } from "~/worker/handlers.ts";

declare const self: ServiceWorkerGlobalScope & TypedEventTarget<ServiceWorkerGlobalScopeEventMap>;

const router = createRouter({
    middleware: [
        formData(),
        methodOverride(),
        clientRedirect(),
        ...(import.meta.env.DEV ? [logger()] : []),
    ],
});

router.map(api, handlers);

on(self, {
    install() {
        self.skipWaiting();
    },
    activate() {
        self.clients.claim();
    },
    fetch(event) {
        const url = new URL(event.request.url);
        const sameOrigin = url.origin === location.origin;
        const maybeApi = url.pathname.startsWith("/api/");

        // Only handle same-origin API requests
        if (!sameOrigin || !maybeApi) return;

        event.respondWith(router.fetch(event.request));
    },
});
