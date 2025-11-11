/* @refresh reload */

import { render } from "solid-js/web";
import { Router } from "@solidjs/router";
import { MetaProvider } from "@solidjs/meta";
import "solid-devtools";

import { routes } from "~/routes.ts";
import { WorkerRegistry } from "~/lib/worker-registry";
import { on } from "@remix-run/interaction";

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
