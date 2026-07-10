import PrivacyPolicy from "@/app/(legal)/privacy-policy/page";
import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/privacy-policy")({
	component: PrivacyPolicy,
});
