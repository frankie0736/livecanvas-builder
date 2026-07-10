import { createFileRoute } from "@tanstack/react-router";
import { MigrationPlaceholder } from "./-placeholder";

export const Route = createFileRoute("/_protected/profile/")({
	component: () => <MigrationPlaceholder route="/profile" />,
});
