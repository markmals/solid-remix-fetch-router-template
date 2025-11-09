import { RequestMethod, Route } from "@remix-run/fetch-router";
import { HrefBuilderArgs } from "@remix-run/route-pattern";
import type { RequiredParams } from "../../node_modules/@remix-run/route-pattern/dist/lib/params.d.ts";
import { redirect } from "@solidjs/router";
import { REDIRECT_KEY } from "~/lib/server-middleware.ts";

export type FetchOptions<Pattern extends string> = [RequiredParams<Pattern>] extends [never]
    ? {
          path?: HrefBuilderArgs<Pattern>[0];
          search?: HrefBuilderArgs<Pattern>[1];
          body?: Record<string, any> | FormData | URLSearchParams;
          method?: RequestMethod | "ANY";
      }
    : {
          path: HrefBuilderArgs<Pattern>[0];
          search?: HrefBuilderArgs<Pattern>[1];
          body?: Record<string, any> | FormData | URLSearchParams;
          method?: RequestMethod | "ANY";
      };

type EnhancedRoute<R> =
    R extends Route<any, infer Pattern extends string>
        ? R & {
              fetch: <T = any>(options?: FetchOptions<Pattern>) => Promise<T>;
              key: string;
          }
        : R;

type EnhanceRouteMap<T> = {
    [K in keyof T]: T[K] extends Route<any, any>
        ? EnhancedRoute<T[K]>
        : T[K] extends object
          ? EnhanceRouteMap<T[K]>
          : T[K];
};

function isRoute(obj: any): obj is Route<any, any> {
    return obj && typeof obj === "object" && "href" in obj && "pattern" in obj && "method" in obj;
}

function enhanceRouteMap<T>(map: T): EnhanceRouteMap<T> {
    if (isRoute(map)) {
        return {
            ...map,
            fetch: async (options?: FetchOptions<string>) => {
                const url = options?.search
                    ? map.href(options.path ?? {}, options.search)
                    : map.href(options?.path ?? {});

                function isFormData(body?: unknown): body is FormData {
                    return body instanceof FormData;
                }

                function isURLSearchParams(body?: unknown): body is URLSearchParams {
                    return body instanceof URLSearchParams;
                }

                function isJSON(body?: unknown): body is Record<string, any> {
                    return !isFormData(body) && !isURLSearchParams(body) && Boolean(body);
                }

                const response = await fetch(url, {
                    method: options?.method
                        ? options?.method
                        : map.method === "ANY"
                          ? "GET"
                          : map.method,
                    body: isFormData(options?.body)
                        ? options.body
                        : isURLSearchParams(options?.body)
                          ? options.body
                          : isJSON(options?.body)
                            ? JSON.stringify(options.body)
                            : undefined,
                    headers: isJSON(options?.body)
                        ? { "Content-Type": "application/json" }
                        : undefined,
                });

                // Check if the response contains a redirect instruction
                const location = response.headers.get(REDIRECT_KEY);
                if (location) throw redirect(location);

                // Check if response is ok
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                // Only parse JSON if response has content
                const text = await response.text();
                if (text.length === 0) {
                    return undefined;
                }

                try {
                    return JSON.parse(text);
                } catch (e) {
                    // If JSON parsing fails, return the text
                    return text;
                }
            },
            key: `${map.pattern}:${map.method}`,
        } as any;
    }

    if (typeof map === "object" && map !== null) {
        const result: any = {};
        for (const key in map) {
            result[key] = enhanceRouteMap(map[key]);
        }
        return result;
    }

    return map as any;
}

export function createClient<T>(map: T): EnhanceRouteMap<T> {
    return enhanceRouteMap(map);
}
