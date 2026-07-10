import { z } from "zod";

import { type TaskOutput, type TokenUsage, taskStatuses } from "@/types/task";

const taskRowSchema = z.object({
	id: z.string(),
	user_id: z.string(),
	workflow_instance_id: z.string().nullable(),
	status: z.enum(taskStatuses),
	model: z.string(),
	encrypted_payload: z.string(),
	result: z.string().nullable(),
	error: z.string().nullable(),
	usage: z.string().nullable(),
	created_at: z.number().int(),
	updated_at: z.number().int(),
	completed_at: z.number().int().nullable(),
});

function parseTaskRow(row: unknown) {
	const value = taskRowSchema.parse(row);
	return {
		id: value.id,
		userId: value.user_id,
		workflowInstanceId: value.workflow_instance_id,
		status: value.status,
		modelId: value.model,
		encryptedPayload: value.encrypted_payload,
		result: value.result ? (JSON.parse(value.result) as TaskOutput) : null,
		error: value.error,
		usage: value.usage ? (JSON.parse(value.usage) as TokenUsage) : undefined,
		createdAt: value.created_at,
		updatedAt: value.updated_at,
		completedAt: value.completed_at,
	};
}

const taskColumns = `
	id, user_id, workflow_instance_id, status, model, encrypted_payload,
	result, error, usage, created_at, updated_at, completed_at
`;

function changed(result: D1Result) {
	return (result.meta.changes ?? 0) > 0;
}

export function createTaskRepository(database: D1Database) {
	const getTask = async (taskId: string) => {
		const row = await database
			.prepare(`SELECT ${taskColumns} FROM generation_task WHERE id = ?`)
			.bind(taskId)
			.first();
		return row ? parseTaskRow(row) : null;
	};

	return {
		async create(input: {
			id: string;
			userId: string;
			modelId: string;
			encryptedPayload: string;
		}) {
			const now = Date.now();
			await database
				.prepare(
					`INSERT INTO generation_task
					 (id, user_id, workflow_instance_id, status, model, encrypted_payload, created_at, updated_at)
					 VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?)`,
				)
				.bind(
					input.id,
					input.userId,
					input.id,
					input.modelId,
					input.encryptedPayload,
					now,
					now,
				)
				.run();
			return getTask(input.id);
		},

		get: getTask,

		async getOwned(userId: string, taskId: string) {
			const row = await database
				.prepare(
					`SELECT ${taskColumns} FROM generation_task WHERE id = ? AND user_id = ?`,
				)
				.bind(taskId, userId)
				.first();
			return row ? parseTaskRow(row) : null;
		},

		async markRunning(taskId: string) {
			const result = await database
				.prepare(
					"UPDATE generation_task SET status = 'RUNNING', updated_at = ? WHERE id = ? AND status = 'PENDING'",
				)
				.bind(Date.now(), taskId)
				.run();
			if (changed(result)) return true;
			return (await getTask(taskId))?.status === "RUNNING";
		},

		async complete(taskId: string, output: TaskOutput, usage?: TokenUsage) {
			const now = Date.now();
			const result = await database
				.prepare(
					`UPDATE generation_task
					 SET status = 'COMPLETED', encrypted_payload = '', result = ?, usage = ?,
					     error = NULL, completed_at = ?, updated_at = ?
					 WHERE id = ? AND status = 'RUNNING'`,
				)
				.bind(
					JSON.stringify(output),
					usage ? JSON.stringify(usage) : null,
					now,
					now,
					taskId,
				)
				.run();
			return changed(result);
		},

		async fail(taskId: string, error: string) {
			const now = Date.now();
			const result = await database
				.prepare(
					`UPDATE generation_task
					 SET status = 'FAILED', encrypted_payload = '', result = NULL, usage = NULL,
					     error = ?, completed_at = ?, updated_at = ?
					 WHERE id = ? AND status IN ('PENDING', 'RUNNING')`,
				)
				.bind(error, now, now, taskId)
				.run();
			return changed(result);
		},

		async cancel(userId: string, taskId: string) {
			const now = Date.now();
			const result = await database
				.prepare(
					`UPDATE generation_task
					 SET status = 'CANCELED', encrypted_payload = '', result = NULL, usage = NULL,
					     error = 'Task cancelled', completed_at = ?, updated_at = ?
					 WHERE id = ? AND user_id = ? AND status IN ('PENDING', 'RUNNING')`,
				)
				.bind(now, now, taskId, userId)
				.run();
			return changed(result);
		},
	};
}

export type TaskRepository = ReturnType<typeof createTaskRepository>;
