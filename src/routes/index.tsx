import { createFileRoute } from "@tanstack/react-router";
import { MigrationPlaceholder } from "./-placeholder";

export const Route = createFileRoute("/")({
	component: () => <MigrationPlaceholder route="/" />,
});
