import { describe, expect, it } from "bun:test";

import {
	AIHUBMIX_MODELS_URL,
	buildRecommendedModelIds,
	fetchAihubmixModelCatalog,
	normalizeAihubmixModels,
	selectFeaturedAihubmixModels,
} from "../catalog";

describe("AIHubMix model catalog", () => {
	it("normalizes LLM rows, display names, modalities, and prices", () => {
		const models = normalizeAihubmixModels({
			data: [
				{
					model_id: "claude-sonnet-5",
					model_name: "Claude Sonnet 5",
					name: "Long description",
					types: "llm",
					features: "coding,reasoning",
					input_modalities: "text,image",
					context_length: "200000",
					max_output: "64000",
					pricing: { input: 3, output: 15 },
				},
				{
					model_id: "gpt-image-2",
					model_name: "GPT Image 2",
					types: "image_generation",
				},
			],
		});

		expect(models).toEqual([
			{
				id: "claude-sonnet-5",
				name: "Claude Sonnet 5",
				vendor: "anthropic",
				types: ["llm"],
				features: ["coding", "reasoning"],
				inputModalities: ["text", "image"],
				contextLength: 200000,
				maxOutput: 64000,
				price: { input: 3, output: 15 },
			},
		]);
	});

	it("selects recent official GPT generations and latest Claude families", () => {
		const models = normalizeAihubmixModels({
			data: [
				{ model_id: "gpt-5.6-terra", types: "llm" },
				{ model_id: "gpt-5.6-sol", types: "llm" },
				{ model_id: "gpt-5.5-free", types: "llm" },
				{ model_id: "gpt-5.5", types: "llm" },
				{ model_id: "gpt-5.4", types: "llm" },
				{ model_id: "gpt-5.7-preview", types: "llm" },
				{ model_id: "claude-opus-4-8-think", types: "llm" },
				{ model_id: "claude-opus-4-7", types: "llm" },
				{ model_id: "claude-opus-4-8", types: "llm" },
				{ model_id: "claude-sonnet-4-6", types: "llm" },
				{ model_id: "claude-sonnet-5", types: "llm" },
			],
		});

		expect(selectFeaturedAihubmixModels(models).map(({ id }) => id)).toEqual([
			"gpt-5.6-sol",
			"gpt-5.5",
			"claude-sonnet-5",
			"claude-opus-4-8",
		]);
	});

	it("uses all featured models as recommendations", () => {
		expect(
			buildRecommendedModelIds([
				{ id: "gpt-5.6-sol" },
				{ id: "gpt-5.5" },
				{ id: "claude-sonnet-5" },
			]),
		).toEqual(["gpt-5.6-sol", "gpt-5.5", "claude-sonnet-5"]);
	});

	it("fetches with only the caller key and no cache", async () => {
		const calls: Array<{ url: string; init?: RequestInit }> = [];
		const catalog = await fetchAihubmixModelCatalog(
			"  caller-key  ",
			async (url, init) => {
				calls.push({ url, init });
				return Response.json({
					data: [{ model_id: "claude-sonnet-5", types: "llm" }],
				});
			},
		);

		expect(calls).toEqual([
			{
				url: AIHUBMIX_MODELS_URL,
				init: {
					headers: { Authorization: "Bearer caller-key" },
					cache: "no-store",
				},
			},
		]);
		expect(catalog.models.map(({ id }) => id)).toEqual(["claude-sonnet-5"]);
	});

	it("fails closed for empty or unmatched catalogs", async () => {
		await expect(
			fetchAihubmixModelCatalog("key", async () => Response.json({ data: [] })),
		).rejects.toThrow("AIHubMix returned no LLM models");
		await expect(
			fetchAihubmixModelCatalog("key", async () =>
				Response.json({ data: [{ model_id: "gemini-3.5", types: "llm" }] }),
			),
		).rejects.toThrow("AIHubMix returned no featured GPT or Claude models");
	});
});
