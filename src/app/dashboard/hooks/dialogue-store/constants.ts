import type { Dialogue } from "@/types/common";
import type { AvailableModelId, AvailableProviderId } from "@/types/model";

// Default provider and model values
export const defaultProviderId: AvailableProviderId = "aihubmix";
export const defaultModelId: AvailableModelId = "";

// Initial dialogue
export const defaultDialogue: Dialogue = {
	id: 1,
	submissions: [],
	activeSubmissionId: null,
	selectedProviderId: defaultProviderId,
	selectedModelId: defaultModelId,
};
