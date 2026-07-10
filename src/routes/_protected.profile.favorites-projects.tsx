import { createFileRoute } from "@tanstack/react-router";
import { MigrationPlaceholder } from "./-placeholder";

export const Route = createFileRoute("/_protected/profile/favorites-projects")({
	component: () => <MigrationPlaceholder route="/profile/favorites-projects" />,
});
