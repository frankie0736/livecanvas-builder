import {
	AihubmixModelCatalogError,
	fetchAihubmixModelCatalog,
	isAihubmixModelId,
} from "@/lib/aihubmix";
import type { PollTaskResult, TaskCancellationResponse } from "@/types/task";
import type { GenerationWorkflowParams } from "@/workflows/generation-runner";
import { encryptTaskPayload } from "./encryption";
import { type TaskSubmitInput, taskSubmitSchema } from "./input";
import type { TaskRepository } from "./repository";

type WorkflowBinding = Pick<
	Workflow<GenerationWorkflowParams>,
	"create" | "get"
>;

export class TaskServiceError extends Error {
	readonly status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = "TaskServiceError";
		this.status = status;
	}
}

export function createGenerationTaskService(input: {
	repository: TaskRepository;
	workflow: WorkflowBinding;
	payloadKey: string;
	fetchCatalog?: typeof fetchAihubmixModelCatalog;
	createId?: () => string;
}) {
	const fetchCatalog = input.fetchCatalog ?? fetchAihubmixModelCatalog;
	const createId = input.createId ?? crypto.randomUUID;

	return {
		async submit(
			user: { id: string; backgroundInfo?: string | null },
			unparsed: unknown,
		): Promise<PollTaskResult> {
			const request = taskSubmitSchema.parse(unparsed);
			let catalog: Awaited<ReturnType<typeof fetchCatalog>>;
			try {
				catalog = await fetchCatalog(request.apiKey);
			} catch (error) {
				if (error instanceof AihubmixModelCatalogError) {
					throw new TaskServiceError(
						error.message,
						error.status === 401 ? 400 : 502,
					);
				}
				throw error;
			}
			if (!isAihubmixModelId(catalog.models, request.modelId)) {
				throw new TaskServiceError("Invalid model", 400);
			}
			const taskId = createId();
			const encryptedPayload = await encryptTaskPayload(
				{
					prompt: request.prompt,
					history: request.history,
					modelId: request.modelId,
					apiKey: request.apiKey,
					backgroundInfo: request.withBackgroundInfo
						? (user.backgroundInfo ?? undefined)
						: undefined,
					precisionMode: request.precisionMode ?? false,
				},
				input.payloadKey,
				taskId,
			);
			await input.repository.create({
				id: taskId,
				userId: user.id,
				modelId: request.modelId,
				encryptedPayload,
			});
			try {
				await input.workflow.create({
					id: taskId,
					params: { taskId, encryptedPayload },
				});
			} catch (error) {
				await input.repository.fail(taskId, "Failed to start processing task");
				console.error({
					event: "generation_workflow_create_failed",
					task_id: taskId,
					user_id: user.id,
					error: error instanceof Error ? error.message : String(error),
				});
				throw new TaskServiceError("Failed to start processing task", 500);
			}
			return pendingResult(taskId);
		},

		async status(userId: string, taskId: string): Promise<PollTaskResult> {
			const task = await input.repository.getOwned(userId, taskId);
			if (!task) throw new TaskServiceError("Task not found", 404);
			if (task.status === "COMPLETED" && task.result) {
				return {
					taskId,
					status: task.status,
					...task.result,
					usage: task.usage,
				};
			}
			if (task.status === "PENDING" || task.status === "RUNNING") {
				return { ...pendingResult(taskId), status: task.status };
			}
			return {
				taskId,
				status: task.status,
				code: "<!-- Error: Failed to generate valid HTML -->",
				advices: [],
				error:
					task.status === "CANCELED"
						? "任务已被取消"
						: (task.error ?? undefined),
			};
		},

		async cancel(
			userId: string,
			taskId: string,
		): Promise<TaskCancellationResponse> {
			const task = await input.repository.getOwned(userId, taskId);
			if (!task) throw new TaskServiceError("Task not found", 404);
			if (task.status === "CANCELED") {
				return { success: true, message: "Task cancelled successfully" };
			}
			if (task.status === "COMPLETED" || task.status === "FAILED") {
				return { success: false, message: "Task cannot be cancelled" };
			}
			const canceled = await input.repository.cancel(userId, taskId);
			if (!canceled) {
				return { success: false, message: "Task cannot be cancelled" };
			}
			try {
				const instance = await input.workflow.get(taskId);
				await instance.terminate();
			} catch (error) {
				// D1 cancellation remains authoritative if the Workflow already stopped.
				console.error({
					event: "generation_workflow_terminate_failed",
					task_id: taskId,
					user_id: userId,
					error: error instanceof Error ? error.message : String(error),
				});
			}
			return { success: true, message: "Task cancelled successfully" };
		},
	};
}

function pendingResult(taskId: string): PollTaskResult {
	return {
		taskId,
		status: "PENDING",
		code: "<!-- Processing your request, please check back later -->",
		advices: [
			"Your request is being processed",
			"任务已经开始处理",
			"请稍后查看结果",
		],
	};
}

export type GenerationTaskService = ReturnType<
	typeof createGenerationTaskService
>;
export type { TaskSubmitInput };
