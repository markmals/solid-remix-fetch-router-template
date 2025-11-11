import { api } from "~/api.ts";
import { createClient } from "~/lib/fetch-client.ts";

export const client = createClient(api);

export const queries = {};
