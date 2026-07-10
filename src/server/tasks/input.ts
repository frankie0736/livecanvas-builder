import { z } from "zod";

export const taskSubmitSchema = z.object({
	prompt: z.string().trim().min(1).max(100_000),
	history: z
		.array(
			z.object({
				prompt: z.string().max(100_000),
				response: z.string().max(1_000_000).optional(),
			}),
		)
		.max(20)
		.optional(),
	providerId: z.literal("aihubmix"),
	modelId: z.string().trim().min(1).max(200),
	apiKey: z.string().trim().min(1).max(2_000),
	withBackgroundInfo: z.boolean().optional(),
	precisionMode: z.boolean().optional(),
	dialogueId: z.number().int().optional(),
	submissionId: z.number().int().optional(),
});

export type TaskSubmitInput = z.infer<typeof taskSubmitSchema>;

export interface TaskWorkflowPayload {
	prompt: string;
	history?: Array<{ prompt: string; response?: string }>;
	modelId: string;
	apiKey: string;
	backgroundInfo?: string;
	precisionMode: boolean;
}
