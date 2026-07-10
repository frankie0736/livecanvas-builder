import { describe, expect, it } from "bun:test";

import type { AihubmixModelCatalog } from "@/lib/aihubmix";
import {
	calculateCatalogCost,
	filterCatalogModels,
	isTaskSubmissionReady,
	resolveSelectedModelId,
} from "../catalog-state";

const catalog: AihubmixModelCatalog = {
	models: [
		{
			id: "gpt-5.6-sol",
			name: "GPT 5.6 Sol",
			vendor: "openai",
			types: ["llm"],
			features: ["coding"],
			inputModalities: ["text"],
			contextLength: 200000,
			maxOutput: 64000,
			price: { input: 2, output: 8 },
		},
		{
			id: "claude-sonnet-5",
			name: "Claude Sonnet 5",
			vendor: "anthropic",
			types: ["llm"],
			features: ["reasoning"],
			inputModalities: ["text", "image"],
			contextLength: 200000,
			maxOutput: 64000,
			price: { input: 3, output: 15 },
		},
	],
	recommendedModelIds: ["claude-sonnet-5", "gpt-5.6-sol"],
	fetchedAt: "2026-07-10T00:00:00.000Z",
};
const gptModel = catalog.models[0];
if (!gptModel) throw new Error("model catalog fixture is empty");

describe("model catalog state", () => {
	it("keeps a valid selection and repairs an invalid selection from recommendations", () => {
		expect(resolveSelectedModelId("gpt-5.6-sol", catalog)).toBe("gpt-5.6-sol");
		expect(resolveSelectedModelId("removed-model", catalog)).toBe(
			"claude-sonnet-5",
		);
	});

	it("searches the same normalized fields displayed by the selector", () => {
		expect(
			filterCatalogModels(catalog.models, "image").map(({ id }) => id),
		).toEqual(["claude-sonnet-5"]);
		expect(
			filterCatalogModels(catalog.models, "coding").map(({ id }) => id),
		).toEqual(["gpt-5.6-sol"]);
	});

	it("derives cost and both submit triggers from the catalog selection", () => {
		expect(
			calculateCatalogCost(gptModel, {
				inputTokens: 1_000_000,
				outputTokens: 500_000,
			}),
		).toBe(6);
		const readiness = {
			prompt: "Create a page",
			hasApiKey: true,
			selectedModelId: "gpt-5.6-sol",
		};
		expect(isTaskSubmissionReady(readiness)).toBe(true);
		expect(isTaskSubmissionReady({ ...readiness, selectedModelId: "" })).toBe(
			false,
		);
	});
});
