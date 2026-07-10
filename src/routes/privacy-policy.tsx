import { createFileRoute } from "@tanstack/react-router";
import { MigrationPlaceholder } from "./-placeholder";
export const Route = createFileRoute("/privacy-policy")({
	component: () => <MigrationPlaceholder route="/privacy-policy" />,
});
