import FavoriteProjectsClient from "@/app/profile/favorites-projects/client";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { getFavoriteProjects } from "@/features/projects/server-functions";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/profile/favorites-projects")({
	loader: () => getFavoriteProjects(),
	component: FavoriteProjectsRoute,
});

function FavoriteProjectsRoute() {
	const projects = Route.useLoaderData();
	return (
		<Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
			<CardHeader>
				<CardTitle>Favorite Projects</CardTitle>
				<CardDescription>
					Browse your favorite projects from the gallery
				</CardDescription>
			</CardHeader>
			<CardContent>
				<FavoriteProjectsClient initialProjects={projects} />
			</CardContent>
		</Card>
	);
}
