import { z } from "zod";

import { createTaskRepository } from "./repository";
import {
	type GenerationTaskService,
	TaskServiceError,
	createGenerationTaskService,
} from "./service";

type Session = {
	user: { id: string; backgroundInfo?: string | null };
} | null;
type TaskHttpDependencies = {
	service: GenerationTaskService;
	getSession: (headers: Headers) => Promise<Session>;
};
type DependencyLoader = () => Promise<TaskHttpDependencies>;

async function productionDependencies() {
	const [{ env }, { getSession }] = await Promise.all([
		import("cloudflare:workers"),
		import("@/server/auth"),
	]);
	const workerEnv = env as Env & { TASK_PAYLOAD_KEY: string };
	return {
		service: createGenerationTaskService({
			repository: createTaskRepository(workerEnv.DB),
			workflow: workerEnv.CHAT_GENERATION,
			payloadKey: workerEnv.TASK_PAYLOAD_KEY,
		}),
		getSession,
	};
}

export function createSubmitHandler(
	load: DependencyLoader = productionDependencies,
) {
	return async ({ request }: { request: Request }) => {
		const requestId = crypto.randomUUID();
		try {
			const dependencies = await load();
			const session = await dependencies.getSession(request.headers);
			if (!session) return taskError("Unauthorized", 401);
			const result = await dependencies.service.submit(
				{
					id: session.user.id,
					backgroundInfo: session.user.backgroundInfo,
				},
				await request.json(),
			);
			return noStoreJson(result);
		} catch (error) {
			const status = taskErrorStatus(error);
			console.error({
				event: "task_submit_failed",
				request_id: requestId,
				status,
				error: safeErrorMessage(error),
			});
			return taskError(safeClientMessage(error), status);
		}
	};
}

export function createStatusHandler(
	load: DependencyLoader = productionDependencies,
) {
	return async ({ request }: { request: Request }) => {
		try {
			const dependencies = await load();
			const session = await dependencies.getSession(request.headers);
			if (!session) return noStoreJson({ error: "Unauthorized" }, 401);
			const taskId = new URL(request.url).searchParams.get("taskId")?.trim();
			if (!taskId)
				return noStoreJson({ error: "Missing taskId parameter" }, 400);
			return noStoreJson(
				await dependencies.service.status(session.user.id, taskId),
			);
		} catch (error) {
			return noStoreJson(
				{ error: safeClientMessage(error) },
				taskErrorStatus(error),
			);
		}
	};
}

export function createCancelHandler(
	load: DependencyLoader = productionDependencies,
) {
	return async ({ request }: { request: Request }) => {
		try {
			const dependencies = await load();
			const session = await dependencies.getSession(request.headers);
			if (!session) return noStoreJson({ error: "Unauthorized" }, 401);
			const { taskId } = z
				.object({ taskId: z.string().trim().min(1) })
				.parse(await request.json());
			return noStoreJson(
				await dependencies.service.cancel(session.user.id, taskId),
			);
		} catch (error) {
			return noStoreJson(
				{ success: false, message: safeClientMessage(error) },
				taskErrorStatus(error),
			);
		}
	};
}

function noStoreJson(body: unknown, status = 200) {
	return Response.json(body, {
		status,
		headers: { "Cache-Control": "no-store, max-age=0" },
	});
}

function taskError(message: string, status: number) {
	return noStoreJson(
		{
			error: message,
			code: "<!-- Error: Failed to generate valid HTML -->",
			advices: ["Try a different prompt or model"],
		},
		status,
	);
}

function taskErrorStatus(error: unknown) {
	if (error instanceof TaskServiceError) return error.status;
	if (error instanceof z.ZodError || error instanceof SyntaxError) return 400;
	return 500;
}

function safeErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

function safeClientMessage(error: unknown) {
	if (error instanceof TaskServiceError) return error.message;
	if (error instanceof z.ZodError || error instanceof SyntaxError) {
		return "Invalid request format";
	}
	return "Task request failed";
}
