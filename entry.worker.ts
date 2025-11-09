import { on, TypedEventTarget } from "@remix-run/interaction";
import { router } from "~/worker/router";

declare const self: ServiceWorkerGlobalScope & TypedEventTarget<ServiceWorkerGlobalScopeEventMap>;

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
