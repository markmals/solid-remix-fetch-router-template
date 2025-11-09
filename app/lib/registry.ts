import { TypedEventTarget } from "./typed-event-target.ts";

interface RegistryEventMap {
    registered: RegistryEvent;
}

class RegistryEvent extends Event {
    constructor(name: keyof RegistryEventMap) {
        super(name);
    }
}

export class WorkerRegistry extends TypedEventTarget<RegistryEventMap> {
    #entry: string;

    /**
     * @default import.meta.env.DEV ? "/entry.worker.ts" : "/entry.worker.js"
     */
    constructor(entry?: string) {
        super();
        this.#entry = entry ?? (import.meta.env.DEV ? "/entry.worker.ts" : "/entry.worker.js");
    }

    async register() {
        if (!navigator.serviceWorker.controller) {
            await navigator.serviceWorker.register(this.#entry, { type: "module" });
            window.location.reload();
        } else {
            this.dispatchEvent(new RegistryEvent("registered"));
        }
    }
}
