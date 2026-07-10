import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { decideRouteAccess } from "@/server/auth/route-policy";
import { getRouteSession } from "@/server/auth/route-session";

export const Route = createFileRoute("/_guest")({
	beforeLoad: async ({ location }) => {
		const session = await getRouteSession();
		const decision = decideRouteAccess("guest", session, location.href);
		if (decision) throw redirect(decision);
		return { session };
	},
	component: Outlet,
});
