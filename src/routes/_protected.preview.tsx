import { PreviewContent } from "@/app/preview/components/preview-content";
import PreviewLayout from "@/app/preview/layout";
import { authClient } from "@/lib/auth-client";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/preview")({
	validateSearch: (search: Record<string, unknown>) => ({
		d: typeof search.d === "string" ? search.d : undefined,
		s: typeof search.s === "string" ? search.s : undefined,
	}),
	component: PreviewRoute,
});

function PreviewRoute() {
	const { data: session } = authClient.useSession();
	return (
		<PreviewLayout>
			<PreviewContent session={session} />
		</PreviewLayout>
	);
}
