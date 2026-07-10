import type { AihubmixModel, AihubmixModelCatalog } from "@/lib/aihubmix";

export function resolveSelectedModelId(
	currentModelId: string | null,
	catalog: AihubmixModelCatalog,
) {
	if (
		currentModelId &&
		catalog.models.some(({ id }) => id === currentModelId)
	) {
		return currentModelId;
	}
	return catalog.recommendedModelIds[0] ?? catalog.models[0]?.id ?? null;
}

export function filterCatalogModels(models: AihubmixModel[], query: string) {
	const search = query.trim().toLowerCase();
	if (!search) return models;
	return models.filter((model) =>
		[
			model.id,
			model.name,
			model.vendor,
			...model.types,
			...model.features,
			...model.inputModalities,
		].some((value) => value.toLowerCase().includes(search)),
	);
}

export function calculateCatalogCost(
	model: Pick<AihubmixModel, "price">,
	usage: { inputTokens: number; outputTokens: number },
) {
	return (
		(model.price.input * usage.inputTokens +
			model.price.output * usage.outputTokens) /
		1_000_000
	);
}

export function isTaskSubmissionReady(input: {
	prompt: string | null | undefined;
	hasApiKey: boolean;
	selectedModelId: string | null | undefined;
}) {
	return (
		Boolean(input.prompt?.trim()) &&
		input.hasApiKey &&
		Boolean(input.selectedModelId?.trim())
	);
}
