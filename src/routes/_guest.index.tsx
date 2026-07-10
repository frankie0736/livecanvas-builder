import { createFileRoute } from "@tanstack/react-router";
import { MigrationPlaceholder } from "./-placeholder";

export const Route = createFileRoute("/_guest/")({
	component: () => <MigrationPlaceholder route="/" />,
});
