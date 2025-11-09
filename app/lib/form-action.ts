import type { HrefBuilderArgs } from "@remix-run/route-pattern";
import type { RequestMethod, Route } from "@remix-run/fetch-router";
import type { Action } from "@solidjs/router";
import { action } from "@solidjs/router";

import { createClient } from "./fetch-client.ts";
import { METHOD_KEY } from "~/lib/server-middleware.ts";

export type FormMethod = Exclude<RequestMethod, "GET">;

// Check if type has no keys by testing if it's exactly {}
type IsEmptyObject<T> = {} extends T ? ([keyof T] extends [never] ? true : false) : false;

// A branded type that cannot be instantiated
declare const __brand: unique symbol;
type Impossible = { [__brand]: never };

type FormActionReturn<Pattern extends string> =
    IsEmptyObject<HrefBuilderArgs<Pattern>[0]> extends true
        ? Omit<Action<[FormData], void>, "with"> & { with(impossible: Impossible): never }
        : Action<[HrefBuilderArgs<Pattern>[0], FormData], void>;

export function formAction<Pattern extends string>(
    route: Route<FormMethod, Pattern>,
): FormActionReturn<Pattern> {
    type Args =
        IsEmptyObject<HrefBuilderArgs<Pattern>[0]> extends true
            ? [FormData]
            : [HrefBuilderArgs<Pattern>[0], FormData];

    const { route: client } = createClient({ route });

    const baseAction = action<Args, void>(async (...args: Args): Promise<void> => {
        let urlParams: Record<string, any>;
        let data: FormData | URLSearchParams;

        if (args.length === 1) {
            // no url params
            urlParams = {};
            data = args[0] as FormData | URLSearchParams;
        } else {
            // url params as first arg
            urlParams = args[0] as Record<string, any>;
            data = args[1] as FormData | URLSearchParams;
        }

        if (route.method !== "POST") {
            data.set(METHOD_KEY, route.method);
        }

        await client.fetch({
            path: urlParams,
            method: "POST",
            body: data,
        });
    }, `${route.pattern}:${route.method}`);

    if (route.pattern.source.includes(":")) {
        return baseAction as FormActionReturn<Pattern>;
    } else {
        const simpleAction = baseAction as any;
        simpleAction.with = undefined;
        return simpleAction as FormActionReturn<Pattern>;
    }
}
