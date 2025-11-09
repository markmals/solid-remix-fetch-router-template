import { UserConfig } from "vite";
import solid from "vite-plugin-solid";
import devtools from "solid-devtools/vite";
import { serviceWorker } from "./service-worker.plugin.ts";

export default {
    plugins: [solid(), devtools(), serviceWorker()],
    server: {
        port: 1612,
    },
    experimental: {
        enableNativePlugin: true,
    },
    resolve: {
        tsconfigPaths: true,
    },
} satisfies UserConfig;
