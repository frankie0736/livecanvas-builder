import type { TaskStatus } from "@/types/task";

const transitions: Record<TaskStatus, ReadonlySet<TaskStatus>> = {
	PENDING: new Set(["RUNNING", "FAILED", "CANCELED"]),
	RUNNING: new Set(["COMPLETED", "FAILED", "CANCELED"]),
	COMPLETED: new Set(),
	FAILED: new Set(),
	CANCELED: new Set(),
};

export function canTransitionTask(from: TaskStatus, to: TaskStatus) {
	return transitions[from].has(to);
}

export function isTerminalTaskStatus(status: TaskStatus) {
	return transitions[status].size === 0;
}
