import { describe, expect, it } from "bun:test";

import { fetchCatalogFromApi } from "../model-catalog-provider";

describe("model catalog client", () => {
	it("uses BYOK authorization and disables browser caching", async () => {
		const calls: Array<{ url: string; init?: RequestInit }> = [];
		await fetchCatalogFromApi(" user-key ", async (url, init) => {
			calls.push({ url: String(url), init });
			return Response.json({
				models: [],
				recommendedModelIds: [],
				fetchedAt: "2026-07-10T00:00:00.000Z",
			});
		});

		expect(calls).toEqual([
			{
				url: "/api/models/aihubmix",
				init: {
					headers: { Authorization: "Bearer user-key" },
					cache: "no-store",
				},
			},
		]);
	});
});
