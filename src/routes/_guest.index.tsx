import Home from "@/app/page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_guest/")({
	component: Home,
});
