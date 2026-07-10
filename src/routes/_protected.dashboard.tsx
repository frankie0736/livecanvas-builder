import DashboardLayout from "@/app/dashboard/layout";
import Dashboard from "@/app/dashboard/page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/dashboard")({
	component: () => (
		<DashboardLayout>
			<Dashboard />
		</DashboardLayout>
	),
});
