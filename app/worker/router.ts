import { createRouter } from "@remix-run/fetch-router";
import { formData } from "@remix-run/fetch-router/form-data-middleware";
import { logger } from "@remix-run/fetch-router/logger-middleware";
import { api } from "~/defs/api.ts";
import { clientRedirect, methodOverride } from "../lib/server-middleware.ts";

export const router = createRouter({
    middleware: [
        formData(),
        methodOverride(),
        clientRedirect(),
        ...(import.meta.env.DEV ? [logger()] : []),
    ],
});

router.map(api, {});
