import { describe, expect, it } from "bun:test";

import { decryptTaskPayload } from "../encryption";
import type { TaskWorkflowPayload } from "../input";
import { createTaskRepository } from "../repository";
import { createGenerationTaskService } from "../service";
import { createTaskTestHarness, testPayloadKey } from "./fixtures";

describe("generation task service", () => {
	it("validates from the catalog and sends only encrypted BYOK params", async () => {
		const harness = await createTaskTestHarness();
		try {
			const created: unknown[] = [];
			const repository = createTaskRepository(harness.database);
			const service = createGenerationTaskService({
				repository,
				workflow: {
					create: async (options) => {
						created.push(options);
						return { id: options?.id ?? "" } as never;
					},
					get: async () => ({ terminate: async () => undefined }) as never,
				},
				payloadKey: testPayloadKey,
				createId: () => "task-1",
				fetchCatalog: async () => ({
					models: [{ id: "gpt-5.6-sol" }] as never,
					recommendedModelIds: ["gpt-5.6-sol"],
					fetchedAt: new Date().toISOString(),
				}),
			});
			const result = await service.submit(
				{ id: "user-1", backgroundInfo: "Business context" },
				{
					providerId: "aihubmix",
					modelId: "gpt-5.6-sol",
					prompt: "private prompt",
					apiKey: "secret-user-key",
					withBackgroundInfo: true,
				},
			);

			expect(result).toMatchObject({ taskId: "task-1", status: "PENDING" });
			expect(JSON.stringify(created)).not.toContain("secret-user-key");
			expect(JSON.stringify(created)).not.toContain("private prompt");
			const task = await repository.get("task-1");
			if (!task) throw new Error("task was not created");
			expect(
				await decryptTaskPayload<TaskWorkflowPayload>(
					task.encryptedPayload,
					testPayloadKey,
					"task-1",
				),
			).toMatchObject({
				apiKey: "secret-user-key",
				prompt: "private prompt",
				backgroundInfo: "Business context",
			});
		} finally {
			await harness.dispose();
		}
	});
});
