import { api } from "~/defs/api.ts";
import { createClient } from "~/lib/fetch-client.ts";

export const client = createClient(api);
