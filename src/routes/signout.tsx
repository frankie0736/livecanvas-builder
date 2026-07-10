import { createFileRoute } from "@tanstack/react-router";
import { MigrationPlaceholder } from "./-placeholder";
export const Route = createFileRoute("/signout")({
	component: () => <MigrationPlaceholder route="/signout" />,
});
