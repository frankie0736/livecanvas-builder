import { describe, expect, it } from "bun:test";

import {
	decryptTaskPayload,
	encryptTaskPayload,
	taskLogContext,
} from "../encryption";
import { testPayloadKey } from "./fixtures";

describe("task payload encryption", () => {
	it("round trips with task-bound AES-GCM and redacts logs", async () => {
		const payload = {
			apiKey: "secret-user-key",
			prompt: "private prompt",
			modelId: "gpt-5.6-sol",
		};
		const encrypted = await encryptTaskPayload(
			payload,
			testPayloadKey,
			"task-1",
		);

		expect(encrypted).not.toContain(payload.apiKey);
		expect(encrypted).not.toContain(payload.prompt);
		expect(
			await decryptTaskPayload(encrypted, testPayloadKey, "task-1"),
		).toEqual(payload);
		await expect(
			decryptTaskPayload(encrypted, testPayloadKey, "task-2"),
		).rejects.toThrow();
		expect(
			JSON.stringify(
				taskLogContext({
					taskId: "task-1",
					userId: "user-1",
					modelId: payload.modelId,
				}),
			),
		).not.toContain(payload.apiKey);
	});
});
