import { createServerFn } from "@tanstack/react-start";

export const getRouteSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const [{ getRequestHeaders }, { getSession }] = await Promise.all([
			import("@tanstack/react-start/server"),
			import("@/server/auth"),
		]);
		return getSession(getRequestHeaders());
	},
);
