import { PreviewContent } from "@/app/preview/components/preview-content";
import PreviewLayout from "@/app/preview/layout";
import { authClient } from "@/lib/auth-client";
import { createFileRoute } from "@tanstack/react-router";

type PreviewSearch = { taskId?: string };

export const Route = createFileRoute("/_protected/preview")({
	validateSearch: (search: Record<string, unknown>): PreviewSearch => {
		const taskId =
			typeof search.taskId === "string" ? search.taskId.trim() : "";
		return { taskId: taskId || undefined };
	},
	component: PreviewRoute,
});

function PreviewRoute() {
	const { data: session } = authClient.useSession();
	const { taskId } = Route.useSearch();
	return (
		<PreviewLayout>
			<PreviewContent session={session} taskId={taskId} />
		</PreviewLayout>
	);
}
