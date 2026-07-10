import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/media/$")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				if (!params._splat) return new Response("Not found", { status: 404 });
				const { env } = await import("cloudflare:workers");
				const object = await env.ASSETS.get(params._splat);
				if (!object) return new Response("Not found", { status: 404 });
				const headers = new Headers();
				object.writeHttpMetadata(headers);
				headers.set("etag", object.httpEtag);
				headers.set("cache-control", "public, max-age=31536000, immutable");
				return new Response(object.body, { headers });
			},
		},
	},
});
