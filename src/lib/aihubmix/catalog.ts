export const AIHUBMIX_PROVIDER_ID = "aihubmix" as const;
export const AIHUBMIX_MODELS_URL =
	"https://aihubmix.com/api/v1/models?types=llm&sort_by=coding";
export const AIHUBMIX_CHAT_BASE_URL = "https://aihubmix.com/v1";

const llmTypes = new Set(["llm", "t2t"]);
const disallowedGptSuffixes = new Set([
	"audio",
	"chat",
	"codex",
	"embedding",
	"free",
	"image",
	"latest",
	"preview",
	"realtime",
	"search",
	"speech",
	"transcribe",
	"tts",
]);

export type AihubmixModelVendor =
	| "openai"
	| "anthropic"
	| "google"
	| "deepseek"
	| "qwen"
	| "other";

export interface AihubmixModel {
	id: string;
	name: string;
	vendor: AihubmixModelVendor;
	types: string[];
	features: string[];
	inputModalities: string[];
	contextLength: number | null;
	maxOutput: number | null;
	price: { input: number; output: number };
}

export interface AihubmixModelCatalog {
	models: AihubmixModel[];
	recommendedModelIds: string[];
	fetchedAt: string;
}

type RawModel = Record<string, unknown>;
type CatalogFetcher = (url: string, init?: RequestInit) => Promise<Response>;

export class AihubmixModelCatalogError extends Error {
	readonly status?: number;

	constructor(message: string, status?: number) {
		super(message);
		this.name = "AihubmixModelCatalogError";
		this.status = status;
	}
}

export async function fetchAihubmixModelCatalog(
	apiKey: string,
	fetcher: CatalogFetcher = fetch,
): Promise<AihubmixModelCatalog> {
	const key = apiKey.trim();
	if (!key) {
		throw new AihubmixModelCatalogError("AIHubMix API key is required", 401);
	}
	const response = await fetcher(AIHUBMIX_MODELS_URL, {
		headers: { Authorization: `Bearer ${key}` },
		cache: "no-store",
	});
	if (!response.ok) {
		throw new AihubmixModelCatalogError(
			`AIHubMix model catalog request failed with status ${response.status}`,
			response.status,
		);
	}
	const models = normalizeAihubmixModels((await response.json()) as unknown);
	if (models.length === 0) {
		throw new AihubmixModelCatalogError("AIHubMix returned no LLM models", 502);
	}
	const featured = selectFeaturedAihubmixModels(models);
	if (featured.length === 0) {
		throw new AihubmixModelCatalogError(
			"AIHubMix returned no featured GPT or Claude models",
			502,
		);
	}
	return {
		models: featured,
		recommendedModelIds: buildRecommendedModelIds(featured),
		fetchedAt: new Date().toISOString(),
	};
}

export function normalizeAihubmixModels(response: unknown): AihubmixModel[] {
	if (!response || typeof response !== "object") return [];
	const data = (response as { data?: unknown }).data;
	if (!Array.isArray(data)) return [];
	return data
		.map(normalizeAihubmixModel)
		.filter((model): model is AihubmixModel => model !== null);
}

export function buildRecommendedModelIds(
	models: Array<Pick<AihubmixModel, "id">>,
	limit = 6,
) {
	return models.slice(0, limit).map(({ id }) => id);
}

export function isAihubmixModelId(
	models: Array<Pick<AihubmixModel, "id">>,
	modelId: string,
) {
	return models.some(({ id }) => id === modelId);
}

export function selectFeaturedAihubmixModels(models: AihubmixModel[]) {
	const selected: AihubmixModel[] = [];
	for (const model of [
		...selectRecentGptModels(models, 2),
		selectLatestClaudeModel(models, "sonnet"),
		selectLatestClaudeModel(models, "opus"),
	]) {
		if (model && !selected.some(({ id }) => id === model.id))
			selected.push(model);
	}
	return selected;
}

function normalizeAihubmixModel(row: unknown): AihubmixModel | null {
	if (!row || typeof row !== "object") return null;
	const raw = row as RawModel;
	const id = readString(raw.model_id) ?? readString(raw.id);
	if (!id) return null;
	const types = readStringList(raw.types);
	if (!types.some((type) => llmTypes.has(type))) return null;
	return {
		id,
		name: readString(raw.model_name) ?? readString(raw.name) ?? id,
		vendor: inferVendor(id),
		types,
		features: readStringList(raw.features),
		inputModalities: readStringList(raw.input_modalities),
		contextLength: readNumber(raw.context_length),
		maxOutput: readNumber(raw.max_output),
		price: {
			input: readPrice(raw, "input"),
			output: readPrice(raw, "output"),
		},
	};
}

function readString(value: unknown) {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readStringList(value: unknown): string[] {
	if (Array.isArray(value)) return value.flatMap(readStringList);
	if (typeof value !== "string") return [];
	return value
		.split(/[,|/]/)
		.map((item) => item.trim().toLowerCase())
		.filter(Boolean);
}

function readNumber(value: unknown) {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value !== "string") return null;
	const number = Number(value);
	return Number.isFinite(number) ? number : null;
}

function readPrice(raw: RawModel, key: "input" | "output") {
	const pricing =
		raw.pricing && typeof raw.pricing === "object"
			? (raw.pricing as RawModel)
			: {};
	return readNumber(pricing[key]) ?? readNumber(raw[`pricing.${key}`]) ?? 0;
}

function inferVendor(modelId: string): AihubmixModelVendor {
	const id = modelId.toLowerCase();
	if (id.startsWith("gpt-") || /^o\d/.test(id)) return "openai";
	if (id.startsWith("claude-")) return "anthropic";
	if (id.startsWith("gemini-")) return "google";
	if (id.startsWith("deepseek-")) return "deepseek";
	if (id.startsWith("qwen")) return "qwen";
	return "other";
}

type Candidate = {
	model: AihubmixModel;
	version: number[];
	index: number;
	preference: number;
};

function selectRecentGptModels(models: AihubmixModel[], limit: number) {
	const generations = new Map<string, Candidate[]>();
	models.forEach((model, index) => {
		const candidate = parseGptCandidate(model, index);
		if (!candidate) return;
		const key = candidate.version.join(".");
		generations.set(key, [...(generations.get(key) ?? []), candidate]);
	});
	return [...generations.values()]
		.map(
			(candidates) =>
				[...candidates].sort(compareCandidatePreference)[0] as Candidate,
		)
		.sort((left, right) => compareVersions(left.version, right.version))
		.slice(0, limit)
		.map(({ model }) => model);
}

function parseGptCandidate(model: AihubmixModel, index: number) {
	const match = /^gpt-(\d+(?:\.\d+)?)(?:-([a-z0-9][a-z0-9-]*))?$/.exec(
		model.id.toLowerCase(),
	);
	if (!match) return null;
	const suffix = match[2] ?? "";
	if (suffix.split("-").some((token) => disallowedGptSuffixes.has(token))) {
		return null;
	}
	return {
		model,
		version: parseVersion(match[1] ?? ""),
		index,
		preference: gptSuffixPreference(suffix),
	} satisfies Candidate;
}

function gptSuffixPreference(suffix: string) {
	const preferences: Record<string, number> = {
		"": 100,
		sol: 90,
		terra: 80,
		luna: 70,
		pro: 60,
		high: 50,
		low: 40,
		mini: 30,
		nano: 20,
	};
	return preferences[suffix] ?? 10;
}

function selectLatestClaudeModel(
	models: AihubmixModel[],
	family: "sonnet" | "opus",
) {
	return models
		.map((model, index) => parseClaudeCandidate(model, index, family))
		.filter((candidate): candidate is Candidate => candidate !== null)
		.sort((left, right) => {
			const order = compareVersions(left.version, right.version);
			return order === 0 ? left.index - right.index : order;
		})[0]?.model;
}

function parseClaudeCandidate(
	model: AihubmixModel,
	index: number,
	family: "sonnet" | "opus",
) {
	const match = new RegExp(`^claude-${family}-(\\d+(?:[-.]\\d+)*)$`).exec(
		model.id.toLowerCase(),
	);
	if (!match) return null;
	return {
		model,
		version: parseVersion(match[1] ?? ""),
		index,
		preference: 0,
	} satisfies Candidate;
}

function parseVersion(version: string) {
	return version.split(/[.-]/).map(Number).filter(Number.isFinite);
}

function compareCandidatePreference(left: Candidate, right: Candidate) {
	return left.preference === right.preference
		? left.index - right.index
		: right.preference - left.preference;
}

function compareVersions(left: number[], right: number[]) {
	for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
		const difference = (right[index] ?? 0) - (left[index] ?? 0);
		if (difference !== 0) return difference;
	}
	return 0;
}
