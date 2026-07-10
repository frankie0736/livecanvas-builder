import { describe, expect, it } from "bun:test";

import {
	createCancelHandler,
	createStatusHandler,
	createSubmitHandler,
} from "../http";

const service = {
	submit: async () => ({
		taskId: "task-1",
		status: "PENDING" as const,
		code: "processing",
		advices: [],
	}),
	status: async () => ({
		taskId: "task-1",
		status: "RUNNING" as const,
		code: "processing",
		advices: [],
	}),
	cancel: async () => ({
		success: true,
		message: "Task cancelled successfully",
	}),
};

const load = async () => ({
	service: service as never,
	getSession: async () =>
		({ user: { id: "user-1", backgroundInfo: null } }) as never,
});

describe("task HTTP contract", () => {
	it("preserves submit, poll, and cancel wire responses with no-store", async () => {
		const submit = await createSubmitHandler(load)({
			request: new Request("http://local.test/api/task/submit", {
				method: "POST",
				body: JSON.stringify({}),
			}),
		});
		const status = await createStatusHandler(load)({
			request: new Request("http://local.test/api/task/status?taskId=task-1"),
		});
		const cancel = await createCancelHandler(load)({
			request: new Request("http://local.test/api/task/cancel", {
				method: "POST",
				body: JSON.stringify({ taskId: "task-1" }),
			}),
		});

		expect((await submit.json()).taskId).toBe("task-1");
		expect((await status.json()).status).toBe("RUNNING");
		expect((await cancel.json()).success).toBe(true);
		expect(submit.headers.get("Cache-Control")).toBe("no-store, max-age=0");
	});

	it("rejects anonymous submit before reading the body", async () => {
		const response = await createSubmitHandler(async () => ({
			service: service as never,
			getSession: async () => null,
		}))({
			request: new Request("http://local.test/api/task/submit", {
				method: "POST",
				body: "not-json",
			}),
		});
		expect(response.status).toBe(401);
	});
});
