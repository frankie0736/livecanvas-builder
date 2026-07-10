import { tryCatch } from "@/lib/try-catch";
import type {
	PollTaskResult,
	TaskCancellationResponse,
	TaskRequest,
} from "@/types/task";
import { replaceLucideIcons } from "@/utils/replace-with-lucide-icon";
import { replaceWithUnsplashImages } from "@/utils/replace-with-unsplash";

async function readError(response: Response) {
	const body = (await response.json().catch(() => ({}))) as { error?: unknown };
	return typeof body.error === "string" ? body.error : undefined;
}

/**
 * Submit a chat task to the API
 */
export async function submitChatTask(params: TaskRequest): Promise<string> {
	const result = await tryCatch(
		fetch("/api/task/submit", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(params),
		}),
	);

	if (result.error) {
		throw new Error(`Failed to submit task: ${result.error.message}`);
	}

	if (!result.data.ok) {
		const error = await readError(result.data);
		throw new Error(
			`Failed to submit task: ${result.data.status} ${result.data.statusText}${
				error ? ` - ${error}` : ""
			}`,
		);
	}

	const data = (await result.data.json()) as PollTaskResult;

	if (!data.taskId) {
		throw new Error("No task ID returned from the server");
	}

	return data.taskId;
}

/**
 * Poll for task status until completion or error
 */
export async function pollTaskStatus(
	taskId: string,
	intervalMs = 3000,
	maxAttempts = 100,
): Promise<PollTaskResult> {
	let attempts = 0;

	const pollOnce = async (): Promise<PollTaskResult> => {
		if (attempts >= maxAttempts) {
			throw new Error("Max polling attempts reached");
		}

		attempts++;

		const result = await tryCatch(
			fetch(`/api/task/status?taskId=${taskId}`, {
				headers: { "Cache-Control": "no-cache" },
			}),
		);

		if (result.error) {
			throw new Error(`Network error while polling: ${result.error.message}`);
		}

		if (!result.data.ok) {
			if (result.data.status === 404) {
				// Task not found, continue polling
				await new Promise((resolve) => setTimeout(resolve, intervalMs));
				return pollOnce();
			}

			const error = await readError(result.data);
			throw new Error(
				`API error: ${result.data.status} ${result.data.statusText}${
					error ? ` - ${error}` : ""
				}`,
			);
		}

		const data = (await result.data.json()) as PollTaskResult;

		// 根据任务状态处理响应
		switch (data.status) {
			case "PENDING":
			case "RUNNING":
				await new Promise((resolve) => setTimeout(resolve, intervalMs));
				return pollOnce();

			case "FAILED":
				return {
					taskId,
					code: `<!-- 错误: 任务 ${data.status.toLowerCase()} -->`,
					advices: [],
					status: data.status,
					error:
						typeof data.error === "string"
							? data.error
							: JSON.stringify(data.error),
				};

			case "CANCELED":
				return {
					taskId,
					code: "<!-- 任务被取消 -->",
					advices: [],
					status: "CANCELED",
					error: "任务已被取消",
				};

			case "COMPLETED": {
				if (!data.code) {
					throw new Error("Task completed but no output received");
				}
				return {
					...data,
					code: replaceWithUnsplashImages(replaceLucideIcons(data.code)),
				};
			}
		}
	};

	return pollOnce();
}

/**
 * 取消任务
 */
export async function cancelTask(
	taskId: string,
): Promise<TaskCancellationResponse> {
	const result = await tryCatch(
		fetch("/api/task/cancel", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ taskId }),
		}),
	);

	if (result.error) {
		console.error("Failed to cancel task:", result.error);
		return {
			success: false,
			message: `Failed to cancel task: ${result.error.message}`,
		};
	}

	if (!result.data.ok) {
		const error = await readError(result.data);
		return {
			success: false,
			message: `Failed to cancel task: ${result.data.status} ${result.data.statusText}${
				error ? ` - ${error}` : ""
			}`,
		};
	}

	const data = (await result.data.json()) as TaskCancellationResponse;
	return {
		success: true,
		message: data.message || "Task cancelled successfully",
	};
}
