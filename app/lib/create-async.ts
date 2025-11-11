import { createAsync as _createAsync } from "@solidjs/router";
import type { Accessor } from "solid-js";

const NO_OP = Symbol("noop-proxy");

// Common string method shims so things like .slice(1) don't explode
const stringShims: Record<string, (...args: any[]) => any> = {
    slice: () => "",
    trim: () => "",
    toLowerCase: () => "",
    toUpperCase: () => "",
    replace: () => "",
    padStart: () => "",
    padEnd: () => "",
    includes: () => false,
    startsWith: () => false,
    endsWith: () => false,
    concat: () => "",
    substring: () => "",
    repeat: () => "",
    split: () => [],
    match: () => null,
    matchAll: () => [],
};

function makeNoopProxy<T>(): T {
    const target = Object.create(null);
    return new Proxy(target, {
        get(t, prop, receiver) {
            if (prop === NO_OP) return true;

            // Solid/JSX coercions
            if (prop === Symbol.toPrimitive) {
                return (hint: "string" | "number" | "default") => (hint === "number" ? 0 : "");
            }
            if (prop === "toString") return () => "";
            if (prop === "valueOf") return () => "";

            // Don't look like a Promise
            if (prop === "then") return undefined;

            // Friendly shims for common string methods when someone calls them on a noop leaf
            if (typeof prop === "string" && prop in stringShims) {
                return stringShims[prop];
            }

            return "";
        },

        // Keep the proxy inert/opaque
        set() {
            return true;
        },
        has() {
            return false;
        },
        ownKeys() {
            return [];
        },
        getOwnPropertyDescriptor() {
            return undefined;
        },
    });
}

export { makeNoopProxy, NO_OP };

export function createAsync<T>(fetcher: () => Promise<T>): Accessor<T> {
    return _createAsync(fetcher, { initialValue: makeNoopProxy() });
}
