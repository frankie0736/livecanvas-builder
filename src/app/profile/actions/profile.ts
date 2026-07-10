import {
	getProfile,
	updateProfile,
} from "@/features/projects/server-functions";

export async function getCurrentUser() {
	const user = await getProfile();
	return user
		? { success: true as const, user }
		: { success: false as const, error: "User not found" };
}

export async function updateUserProfile(input: {
	name: string;
	image?: string | null;
	backgroundInfo?: string | null;
}) {
	return updateProfile({ data: input });
}
