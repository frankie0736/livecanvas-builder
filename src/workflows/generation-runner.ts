import { z } from "zod";

import { generateAihubmixText } from "@/server/tasks/aihubmix";
import { buildContextualPrompt } from "@/server/tasks/context";
import { decryptTaskPayload } from "@/server/tasks/encryption";
import type { TaskWorkflowPayload } from "@/server/tasks/input";
import { normalizeTaskOutput } from "@/server/tasks/output";
import { createTaskRepository } from "@/server/tasks/repository";
import type { TaskOutput } from "@/types/task";
import { extractAndParseJSON } from "@/utils/json-parser";

export interface GenerationWorkflowParams {
	taskId: string;
	encryptedPayload: string;
}

export interface GenerationWorkflowEnv {
	DB: D1Database;
	TASK_PAYLOAD_KEY: string;
}

type StepConfig = { sensitive: "output" };
export interface GenerationWorkflowStep {
	do<T>(name: string, callback: () => Promise<T>): Promise<T>;
	do<T>(
		name: string,
		config: StepConfig,
		callback: () => Promise<T>,
	): Promise<T>;
}

const outputSchema = z.object({
	code: z.string().min(1),
	advices: z.array(z.string()),
});

type Generator = typeof generateAihubmixText;

export async function executeGenerationTask(
	params: GenerationWorkflowParams,
	env: GenerationWorkflowEnv,
	step: GenerationWorkflowStep,
	generate: Generator = generateAihubmixText,
) {
	const repository = createTaskRepository(env.DB);
	const running = await step.do("mark-running", () =>
		repository.markRunning(params.taskId),
	);
	if (!running) {
		return {
			status: (await repository.get(params.taskId))?.status ?? "CANCELED",
		};
	}

	try {
		const payload = await step.do(
			"decrypt-payload",
			{ sensitive: "output" },
			() =>
				decryptTaskPayload<TaskWorkflowPayload>(
					params.encryptedPayload,
					env.TASK_PAYLOAD_KEY,
					params.taskId,
				),
		);
		const uiTutorial = payload.precisionMode
			? await step.do("load-daisyui-tutorial", async () => {
					try {
						const response = await fetch("https://daisyui.com/llms.txt");
						if (!response.ok) return undefined;
						return response.text();
					} catch {
						// Remove this optional fallback when the tutorial is vendored locally.
						return undefined;
					}
				})
			: undefined;
		const prompt = buildContextualPrompt({
			prompt: payload.prompt,
			backgroundInfo: payload.backgroundInfo,
			history: payload.history,
			uiTutorial,
		});
		const generation = await step.do(
			"generate-content",
			{ sensitive: "output" },
			() =>
				generate({
					modelId: payload.modelId,
					apiKey: payload.apiKey,
					prompt,
				}),
		);
		const output = normalizeTaskOutput(
			outputSchema.parse(extractAndParseJSON<TaskOutput>(generation.text)),
		);
		const completed = await step.do("complete-task", () =>
			repository.complete(params.taskId, output, generation.usage),
		);
		return {
			status: completed ? ("COMPLETED" as const) : ("CANCELED" as const),
		};
	} catch (error) {
		console.error({
			event: "generation_workflow_failed",
			task_id: params.taskId,
			error: error instanceof Error ? error.message : String(error),
		});
		const failed = await step.do("fail-task", () =>
			repository.fail(params.taskId, "Failed to generate content"),
		);
		return {
			status: failed
				? ("FAILED" as const)
				: ((await repository.get(params.taskId))?.status ?? "CANCELED"),
		};
	}
}
