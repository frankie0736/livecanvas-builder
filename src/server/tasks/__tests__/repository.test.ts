import { describe, expect, it } from "bun:test";

import { createTaskRepository } from "../repository";
import { createTaskTestHarness } from "./fixtures";

describe("generation task repository", () => {
	it("lets exactly one terminal transition win and enforces owner reads", async () => {
		const harness = await createTaskTestHarness();
		try {
			const repository = createTaskRepository(harness.database);
			await repository.create({
				id: "task-1",
				userId: "user-1",
				modelId: "gpt-5.6-sol",
				encryptedPayload: "ciphertext",
			});
			expect(await repository.markRunning("task-1")).toBe(true);
			expect(await repository.cancel("user-1", "task-1")).toBe(true);
			expect(
				await repository.complete("task-1", { code: "<main />", advices: [] }),
			).toBe(false);
			expect(await repository.getOwned("other", "task-1")).toBeNull();
			expect(await repository.get("task-1")).toMatchObject({
				status: "CANCELED",
				encryptedPayload: "",
			});
		} finally {
			await harness.dispose();
		}
	});

	it("stores completed output and usage in separate canonical fields", async () => {
		const harness = await createTaskTestHarness();
		try {
			const repository = createTaskRepository(harness.database);
			await repository.create({
				id: "task-2",
				userId: "user-1",
				modelId: "claude-sonnet-5",
				encryptedPayload: "ciphertext",
			});
			await repository.markRunning("task-2");
			await repository.complete(
				"task-2",
				{ code: "<main />", advices: ["Improve spacing"] },
				{ promptTokens: 10, completionTokens: 20, totalTokens: 30 },
			);
			expect(await repository.get("task-2")).toMatchObject({
				status: "COMPLETED",
				result: { code: "<main />", advices: ["Improve spacing"] },
				usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
			});
		} finally {
			await harness.dispose();
		}
	});
});
