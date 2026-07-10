"use client";

import { authClient } from "@/lib/auth-client";
import { Logo } from "./logo";
import { NavItems } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";
import { UserAuthMenu } from "./user-auth-menu";

export function MainNav() {
	const { data: session } = authClient.useSession();

	return (
		<nav className="border-zinc-200 border-b bg-white dark:border-zinc-800 dark:bg-zinc-950">
			<div className="container mx-auto flex h-16 items-center justify-between px-4">
				<div className="flex items-center gap-6">
					<Logo />
					<NavItems />
				</div>
				<div className="flex items-center gap-4">
					<UserAuthMenu session={session} />
					<ThemeToggle />
				</div>
			</div>
		</nav>
	);
}
