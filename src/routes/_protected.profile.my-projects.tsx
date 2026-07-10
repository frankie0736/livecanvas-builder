import { createFileRoute } from "@tanstack/react-router";
import { MigrationPlaceholder } from "./-placeholder";

export const Route = createFileRoute("/_protected/profile/my-projects")({
	component: () => <MigrationPlaceholder route="/profile/my-projects" />,
});
