import Wizard from "@/app/wizard/page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/wizard")({
	component: Wizard,
});
