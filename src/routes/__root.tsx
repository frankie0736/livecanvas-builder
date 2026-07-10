/// <reference types="vite/client" />

import globalCss from "@/styles/globals.css?url";
import {
	HeadContent,
	Outlet,
	Scripts,
	createRootRoute,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Livecanvs Builder" },
			{ name: "description", content: "Build your own Livecanvs" },
		],
		links: [
			{ rel: "stylesheet", href: globalCss },
			{ rel: "icon", href: "/favicon.ico" },
		],
	}),
	component: Outlet,
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
