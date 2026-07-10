import {
	toggleFavorite,
	togglePurchase,
} from "@/features/projects/server-functions";

export async function purchaseProject(projectId: string, _userId?: string) {
	const result = await togglePurchase({ data: { projectId } });
	return { success: true as const, purchased: result.purchased };
}

export async function favoriteProject(projectId: string, _userId?: string) {
	const result = await toggleFavorite({ data: { projectId } });
	return { success: true as const, favorited: result.favorited };
}
