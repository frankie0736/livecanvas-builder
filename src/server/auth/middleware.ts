import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { requireSession } from "./index";

export const authMiddleware = createMiddleware({ type: "function" }).server(
	async ({ next }) => {
		const session = await requireSession(getRequestHeaders());
		return next({ context: { session } });
	},
);
