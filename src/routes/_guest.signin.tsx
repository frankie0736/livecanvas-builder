import SignIn from "@/app/(auth)/signin/page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_guest/signin")({
	component: SignIn,
});
