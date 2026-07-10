export const taskStatuses = [
	"PENDING",
	"RUNNING",
	"COMPLETED",
	"FAILED",
	"CANCELED",
] as const;

export type TaskStatus = (typeof taskStatuses)[number];

export interface DialogueHistory {
	prompt: string;
	response?: string;
}

export interface TaskRequest {
	prompt: string;
	history?: DialogueHistory[];
	providerId: "aihubmix";
	modelId: string;
	apiKey: string;
	withBackgroundInfo?: boolean;
	precisionMode?: boolean;
	dialogueId: number;
	submissionId: number;
}

export interface TokenUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

export interface TaskOutput {
	code: string;
	advices: string[];
}

export interface PollTaskResult extends TaskOutput {
	taskId: string;
	usage?: TokenUsage;
	status: TaskStatus;
	error?: string;
}

export interface TaskCancellationResponse {
	success: boolean;
	message: string;
}
