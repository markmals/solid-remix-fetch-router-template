import { RouteHandlers } from "@remix-run/fetch-router";
import type { api } from "~/api.ts";

export const handlers = {} satisfies RouteHandlers<typeof api>;
