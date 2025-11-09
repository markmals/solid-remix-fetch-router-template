import { ParentProps, Suspense } from "solid-js";
import { Link, Title } from "@solidjs/meta";
import { useInstallGlobalNavigation } from "~/lib/use-install-global-nav.ts";

// import styles from "~/index.css?url";

export default function Root(props: ParentProps) {
    useInstallGlobalNavigation();

    return (
        <>
            <Title>Solid Router + Remix Fetch Router Template</Title>
            {/* <Link rel="stylesheet" href={styles} /> */}
            <Suspense fallback={<p class="loading">Loading...</p>}>
                <h1>Hello, World!</h1>
                {props.children}
            </Suspense>
        </>
    );
}
