import { createFileRoute } from "@tanstack/react-router";

async function handleAuth({ request }: { request: Request }) {
	const { auth } = await import("@/server/auth");
	return auth.handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: handleAuth,
			POST: handleAuth,
		},
	},
});
