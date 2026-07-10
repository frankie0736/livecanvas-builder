import { createFileRoute } from "@tanstack/react-router";
import { MigrationPlaceholder } from "./-placeholder";

export const Route = createFileRoute("/_protected/profile/api-keys")({
	component: () => <MigrationPlaceholder route="/profile/api-keys" />,
});
