import { createProject as createProjectOnServer } from "@/features/projects/server-functions";

export async function createProject(
	_userId: string | undefined,
	data: {
		title: string;
		description?: string;
		htmlContent: string;
		thumbnail?: string;
		tags?: string;
		isPublished: boolean;
		projectId?: string;
	},
) {
	return createProjectOnServer({ data });
}
