import { authClient } from "@/lib/auth-client";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/_protected/example")({
	component: Example,
});

function Example() {
	const { data: session, refetch } = authClient.useSession();
	const [randomNumber] = useState(() => Math.random());
	return (
		<main>
			<p>{session ? `Logged in as ${session.user.name}` : "Not logged in"}</p>
			<button type="button" onClick={() => void refetch()}>
				Revalidate
			</button>
			<p>Random number: {randomNumber}</p>
		</main>
	);
}
