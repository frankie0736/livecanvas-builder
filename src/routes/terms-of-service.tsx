import { createFileRoute } from "@tanstack/react-router";
import { MigrationPlaceholder } from "./-placeholder";
export const Route = createFileRoute("/terms-of-service")({
	component: () => <MigrationPlaceholder route="/terms-of-service" />,
});
