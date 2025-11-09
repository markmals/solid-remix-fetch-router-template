import { Plugin } from "vite";

export function serviceWorker(): Plugin {
    return {
        name: "service-worker",
        config: () => ({
            build: {
                rollupOptions: {
                    input: {
                        main: "./index.html",
                        worker: "./entry.worker.ts",
                    },
                    output: {
                        entryFileNames: chunkInfo => {
                            console.log(chunkInfo);
                            return chunkInfo.name === "worker"
                                ? "entry.worker.js"
                                : "[name]-[hash].js";
                        },
                    },
                },
            },
        }),
    };
}
