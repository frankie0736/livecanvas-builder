import { uploadMedia } from "@/features/projects/server-functions";

const DEFAULT_THUMBNAIL =
	"https://images.unsplash.com/photo-1618788372246-79faff0c3742?q=80&w=2070&auto=format&fit=crop";

export async function generateThumbnail(content: string, projectId?: string) {
	if (!content.startsWith("data:image/") || !projectId)
		return DEFAULT_THUMBNAIL;
	return uploadMedia({
		data: {
			kind: "thumbnail",
			dataUrl: content,
			fileName: `${projectId}.jpg`,
			projectId,
		},
	});
}
