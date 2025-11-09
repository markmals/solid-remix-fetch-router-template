/* @refresh reload */

import { render } from "solid-js/web";
import { Router } from "@solidjs/router";
import { MetaProvider } from "@solidjs/meta";
import "solid-devtools";

import { components } from "~/defs/components.ts";
import { WorkerRegistry } from "~/lib/registry";
import { on } from "@remix-run/interaction";

const registry = new WorkerRegistry();

on(registry, {
    registered() {
        render(
            () => (
                <MetaProvider>
                    <Router>{components}</Router>
                </MetaProvider>
            ),
            document.body,
        );
    },
});

await registry.register();
