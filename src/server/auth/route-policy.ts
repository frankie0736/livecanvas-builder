export type RouteAccess = "guest" | "protected" | "public";

type SessionPrincipal = {
	user: { id: string };
};

export function decideRouteAccess(
	access: RouteAccess,
	session: SessionPrincipal | null,
	currentHref: string,
) {
	if (access === "protected" && !session) {
		return {
			to: "/signin" as const,
			search: { redirect: currentHref },
		};
	}
	if (access === "guest" && session) {
		return { to: "/dashboard" as const };
	}
	return null;
}
