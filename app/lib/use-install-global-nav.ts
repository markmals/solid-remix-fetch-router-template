import { on } from "@remix-run/interaction";
import { useNavigate } from "@solidjs/router";

export function useInstallGlobalNavigation() {
    const navigate = useNavigate();

    on(document, {
        submit(event) {
            if (!(event.target instanceof HTMLFormElement)) return;
            if (event.target.method.toUpperCase() === "POST") return;
            if (event.defaultPrevented) return;

            event.preventDefault();
            navigate(new URL(event.target.action).pathname);
        },
    });
}
