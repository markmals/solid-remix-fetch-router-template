import { lazy } from "solid-js";
import type { RouteDefinition } from "@solidjs/router";
import { app } from "./app.ts";

export const components: RouteDefinition[] = [
    {
        path: app.root.pattern.toString(),
        component: lazy(() => import("~/routes/root.tsx")),
        children: [],
    },
];
