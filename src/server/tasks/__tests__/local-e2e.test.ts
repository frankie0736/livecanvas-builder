import { describe, expect, it } from "bun:test";

import {
	type GenerationWorkflowStep,
	executeGenerationTask,
} from "@/workflows/generation-runner";
import { encryptTaskPayload } from "../encryption";
import type { TaskWorkflowPayload } from "../input";
import { createTaskRepository } from "../repository";
import { createTaskTestHarness, testPayloadKey } from "./fixtures";

class ImmediateStep implements GenerationWorkflowStep {
	do<T>(name: string, callback: () => Promise<T>): Promise<T>;
	do<T>(
		name: string,
		config: { sensitive: "output" },
		callback: () => Promise<T>,
	): Promise<T>;
	do<T>(
		_name: string,
		configOrCallback: { sensitive: "output" } | (() => Promise<T>),
		callback?: () => Promise<T>,
	) {
		const run =
			typeof configOrCallback === "function" ? configOrCallback : callback;
		if (!run) throw new Error("workflow step callback is missing");
		return run();
	}
}

async function createEncryptedTask(
	database: D1Database,
	taskId: string,
	overrides: Partial<TaskWorkflowPayload> = {},
) {
	const payload: TaskWorkflowPayload = {
		prompt: "Create a hero section",
		modelId: "gpt-5.6-sol",
		apiKey: "user-key",
		precisionMode: false,
		...overrides,
	};
	const encryptedPayload = await encryptTaskPayload(
		payload,
		testPayloadKey,
		taskId,
	);
	const repository = createTaskRepository(database);
	await repository.create({
		id: taskId,
		userId: "user-1",
		modelId: payload.modelId,
		encryptedPayload,
	});
	return { encryptedPayload, repository };
}

describe("local generation task loop", () => {
	it("completes encrypted BYOK generation into D1", async () => {
		const harness = await createTaskTestHarness();
		try {
			const { encryptedPayload, repository } = await createEncryptedTask(
				harness.database,
				"success-task",
			);
			const result = await executeGenerationTask(
				{ taskId: "success-task", encryptedPayload },
				{ DB: harness.database, TASK_PAYLOAD_KEY: testPayloadKey },
				new ImmediateStep(),
				async ({ apiKey, prompt }) => {
					expect(apiKey).toBe("user-key");
					expect(prompt).toContain("Create a hero section");
					return {
						text: JSON.stringify({
							code: '<section data-theme="light" />',
							advices: ["调整移动端间距"],
						}),
						usage: {
							promptTokens: 10,
							completionTokens: 20,
							totalTokens: 30,
						},
					};
				},
			);

			expect(result.status).toBe("COMPLETED");
			expect(await repository.get("success-task")).toMatchObject({
				status: "COMPLETED",
				encryptedPayload: "",
				result: {
					code: '<section data-theme="light" />',
					advices: ["调整移动端间距"],
				},
			});
		} finally {
			await harness.dispose();
		}
	});

	it("records generation failure as a terminal D1 state", async () => {
		const harness = await createTaskTestHarness();
		try {
			const { encryptedPayload, repository } = await createEncryptedTask(
				harness.database,
				"failed-task",
			);
			const result = await executeGenerationTask(
				{ taskId: "failed-task", encryptedPayload },
				{ DB: harness.database, TASK_PAYLOAD_KEY: testPayloadKey },
				new ImmediateStep(),
				async () => {
					throw new Error("upstream failed");
				},
			);
			expect(result.status).toBe("FAILED");
			expect(await repository.get("failed-task")).toMatchObject({
				status: "FAILED",
				error: "Failed to generate content",
				encryptedPayload: "",
			});
		} finally {
			await harness.dispose();
		}
	});

	it("does not execute a task canceled before Workflow start", async () => {
		const harness = await createTaskTestHarness();
		try {
			const { encryptedPayload, repository } = await createEncryptedTask(
				harness.database,
				"canceled-task",
			);
			await repository.cancel("user-1", "canceled-task");
			let generated = false;
			const result = await executeGenerationTask(
				{ taskId: "canceled-task", encryptedPayload },
				{ DB: harness.database, TASK_PAYLOAD_KEY: testPayloadKey },
				new ImmediateStep(),
				async () => {
					generated = true;
					throw new Error("must not execute");
				},
			);
			expect(result.status).toBe("CANCELED");
			expect(generated).toBe(false);
		} finally {
			await harness.dispose();
		}
	});
});
