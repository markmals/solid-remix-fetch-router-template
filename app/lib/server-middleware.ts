import { Middleware } from "@remix-run/fetch-router";
import { methodOverride as _methodOverride } from "@remix-run/fetch-router/method-override-middleware";

export const METHOD_KEY = "_method";
export const REDIRECT_KEY = "X-Redirect";

export const methodOverride = () => _methodOverride({ fieldName: METHOD_KEY });

// Middleware to convert redirects to empty response with a redirect header
// so they're readable by the client
export function clientRedirect(): Middleware {
    return async (_, next) => {
        const response = await next();

        if (response.status >= 300 && response.status < 400) {
            return new Response(null, {
                status: 200,
                headers: {
                    [REDIRECT_KEY]: response.headers.get("Location")!,
                },
            });
        }

        return response;
    };
}
