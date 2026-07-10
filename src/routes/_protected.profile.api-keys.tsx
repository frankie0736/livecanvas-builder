import ApiKeys from "@/app/profile/api-keys/page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/profile/api-keys")({
	component: ApiKeys,
});
