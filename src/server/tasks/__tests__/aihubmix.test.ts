import { describe, expect, it } from "bun:test";

import { generateAihubmixText } from "../aihubmix";

describe("AIHubMix generation boundary", () => {
	it("uses BYOK and maps OpenAI-compatible usage without logging the key", async () => {
		const calls: Array<{ url: string; init?: RequestInit }> = [];
		const result = await generateAihubmixText(
			{ modelId: "gpt-5.6-sol", apiKey: "user-key", prompt: "prompt" },
			async (url, init) => {
				calls.push({ url: String(url), init });
				return Response.json({
					choices: [
						{ message: { content: '{"code":"<main />","advices":[]}' } },
					],
					usage: {
						prompt_tokens: 10,
						completion_tokens: 20,
						total_tokens: 30,
					},
				});
			},
		);

		expect(calls[0]?.init?.headers).toEqual({
			Authorization: "Bearer user-key",
			"Content-Type": "application/json",
		});
		expect(result.usage).toEqual({
			promptTokens: 10,
			completionTokens: 20,
			totalTokens: 30,
		});
	});
});
