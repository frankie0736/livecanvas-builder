import TermsOfService from "@/app/(legal)/terms-of-service/page";
import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/terms-of-service")({
	component: TermsOfService,
});
