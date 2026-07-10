import { z } from "zod";

import { AIHUBMIX_CHAT_BASE_URL } from "@/lib/aihubmix";
import type { TokenUsage } from "@/types/task";

const completionSchema = z.object({
	choices: z
		.array(
			z.object({
				message: z.object({ content: z.string() }),
			}),
		)
		.min(1),
	usage: z
		.object({
			prompt_tokens: z.number().int().nonnegative(),
			completion_tokens: z.number().int().nonnegative(),
			total_tokens: z.number().int().nonnegative(),
		})
		.optional(),
});

export async function generateAihubmixText(
	input: { modelId: string; apiKey: string; prompt: string },
	fetcher: typeof fetch = fetch,
) {
	const response = await fetcher(`${AIHUBMIX_CHAT_BASE_URL}/chat/completions`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${input.apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: input.modelId,
			messages: [{ role: "user", content: input.prompt }],
		}),
	});
	if (!response.ok) {
		throw new Error(
			`AIHubMix generation failed with status ${response.status}`,
		);
	}
	const result = completionSchema.parse(await response.json());
	const usage: TokenUsage | undefined = result.usage
		? {
				promptTokens: result.usage.prompt_tokens,
				completionTokens: result.usage.completion_tokens,
				totalTokens: result.usage.total_tokens,
			}
		: undefined;
	return {
		text: result.choices[0]?.message.content ?? "",
		usage,
	};
}
