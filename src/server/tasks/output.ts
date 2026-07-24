import type { TaskOutput } from "@/types/task";
import { replaceLucideIcons } from "@/utils/replace-with-lucide-icon";
import { replaceWithUnsplashImages } from "@/utils/replace-with-unsplash";

export function normalizeTaskOutput(output: TaskOutput): TaskOutput {
	return {
		...output,
		code: replaceWithUnsplashImages(replaceLucideIcons(output.code)),
	};
}
