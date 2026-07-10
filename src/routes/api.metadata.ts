import { PROMPT } from "@/app/api/metadata/prompt";
import { metadataSchema } from "@/app/api/metadata/schema";
import { fetchAihubmixModelCatalog } from "@/lib/aihubmix";
import { createOpenAI } from "@ai-sdk/openai";
import { createFileRoute } from "@tanstack/react-router";
import { generateObject } from "ai";
import { z } from "zod";

const metadataBodySchema = z.object({
	htmlContent: z.string().min(1),
	regenerate: z.boolean().optional().default(false),
	apiKey: z.string().trim().min(1),
});

export const Route = createFileRoute("/api/metadata")({
	server: { handlers: { POST: metadataHandler } },
});

async function metadataHandler({ request }: { request: Request }) {
	try {
		const { requireSession } = await import("@/server/auth");
		await requireSession(request.headers);
	} catch {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}
	const parsed = metadataBodySchema.safeParse(
		await request.json().catch(() => null),
	);
	if (!parsed.success) {
		return Response.json({ error: "Invalid request format" }, { status: 400 });
	}
	const catalog = await fetchAihubmixModelCatalog(parsed.data.apiKey).catch(
		() => null,
	);
	const modelId = catalog?.models.find(({ vendor }) => vendor === "openai")?.id;
	if (!modelId) {
		return Response.json(
			{ error: "Failed to select metadata model" },
			{ status: 502 },
		);
	}
	const provider = createOpenAI({
		apiKey: parsed.data.apiKey,
		baseURL: "https://aihubmix.com/v1",
	});
	let userMessage = `Please analyze this HTML content and generate appropriate metadata (title, description, and tags in Chinese):\n\n\`\`\`html\n${parsed.data.htmlContent}\n\`\`\``;
	if (parsed.data.regenerate) {
		userMessage +=
			"\n\nPlease provide different metadata than before, with a new perspective or focus.";
	}
	try {
		const result = await generateObject({
			model: provider(modelId),
			schema: metadataSchema,
			system: PROMPT,
			messages: [{ role: "user", content: userMessage }],
		});
		return Response.json(result.object, {
			headers: { "Cache-Control": "no-store, max-age=0" },
		});
	} catch (error) {
		console.error({
			event: "metadata_generation_failed",
			error_name: error instanceof Error ? error.name : "UnknownError",
		});
		return Response.json(
			{ error: "Failed to generate metadata" },
			{ status: 500 },
		);
	}
}
