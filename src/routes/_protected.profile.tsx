import { Sidebar } from "@/app/profile/compoents/sidebar";
import { Footer } from "@/components/footer";
import { MainNav } from "@/components/nav/main-nav";
import { authClient } from "@/lib/auth-client";
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/profile")({
	component: ProfileLayout,
});

function ProfileLayout() {
	const { data: session } = authClient.useSession();
	return (
		<div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
			<MainNav />
			<main className="flex-1 py-12">
				<div className="container mx-auto px-4">
					<div className="grid grid-cols-1 gap-8 md:grid-cols-12">
						<div className="md:col-span-4 lg:col-span-3">
							<Sidebar session={session} />
						</div>
						<div className="md:col-span-8 lg:col-span-9">
							<Outlet />
						</div>
					</div>
				</div>
			</main>
			<Footer />
		</div>
	);
}
