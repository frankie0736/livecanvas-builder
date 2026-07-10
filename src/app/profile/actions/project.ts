import {
	deleteOwnedProject,
	getFavoriteProjects,
	getOwnedProjects,
	updateOwnedProject,
} from "@/features/projects/server-functions";
import { z } from "zod";

const profileSchema = z.object({
	name: z.string().min(1, { message: "姓名不能为空" }),
	image: z.string().optional(),
	backgroundInfo: z.string().optional(),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

export async function getUserProjects(_userId?: string) {
	const result = await getOwnedProjects();
	return { success: true as const, data: result.projects };
}

export async function getUserFavorites(_userId?: string) {
	return { success: true as const, data: await getFavoriteProjects() };
}

export async function deleteProject(projectId: string, _userId?: string) {
	return deleteOwnedProject({ data: { projectId } });
}

export async function updateProject(
	projectId: string,
	_userId: string | undefined,
	data: {
		title?: string;
		description?: string | null;
		tags?: string | null;
		isPublished?: boolean;
	},
) {
	return updateOwnedProject({ data: { projectId, ...data } });
}
