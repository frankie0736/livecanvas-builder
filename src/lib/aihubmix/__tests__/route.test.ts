import { describe, expect, it } from "bun:test";

import { createAihubmixModelsHandler } from "@/routes/api.models.aihubmix";

describe("AIHubMix model route", () => {
	it("forwards caller authorization and returns no-store catalog", async () => {
		const calls: RequestInit[] = [];
		const handler = createAihubmixModelsHandler(async (_url, init) => {
			calls.push(init ?? {});
			return Response.json({
				data: [{ model_id: "claude-sonnet-5", types: "llm" }],
			});
		});
		const response = await handler({
			request: new Request("http://local.test/api/models/aihubmix", {
				headers: { Authorization: "Bearer user-key" },
			}),
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
		expect(calls[0]?.headers).toEqual({ Authorization: "Bearer user-key" });
	});

	it("never logs the caller key on upstream errors", async () => {
		const events: Array<Record<string, unknown>> = [];
		const handler = createAihubmixModelsHandler(
			async () => new Response(null, { status: 429 }),
			(event) => events.push(event),
		);
		const response = await handler({
			request: new Request("http://local.test/api/models/aihubmix", {
				headers: { Authorization: "Bearer secret-caller-key" },
			}),
		});

		expect(response.status).toBe(429);
		expect(JSON.stringify(events)).not.toContain("secret-caller-key");
		expect(events[0]).toMatchObject({
			event: "aihubmix_catalog_failed",
			status: 429,
		});
	});
});
