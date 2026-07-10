import { uploadMedia } from "@/features/projects/server-functions";

export async function uploadAvatar(
	base64OrBuffer: string | Buffer,
	fileName: string,
	_userId?: string,
	_oldAvatarUrl?: string | null,
) {
	if (
		typeof base64OrBuffer !== "string" ||
		!base64OrBuffer.startsWith("data:")
	) {
		throw new Error("Avatar upload requires a base64 data URL");
	}
	return uploadMedia({
		data: { kind: "avatar", dataUrl: base64OrBuffer, fileName },
	});
}
