import MyProjectsClient from "@/app/profile/my-projects/client";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { getOwnedProjects } from "@/features/projects/server-functions";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/profile/my-projects")({
	loader: () => getOwnedProjects(),
	component: MyProjectsRoute,
});

function MyProjectsRoute() {
	const data = Route.useLoaderData();
	return (
		<Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
			<CardHeader>
				<CardTitle>我的项目</CardTitle>
				<CardDescription>管理你创建的项目</CardDescription>
			</CardHeader>
			<CardContent>
				<MyProjectsClient
					initialProjects={data.projects}
					userId={data.userId}
				/>
			</CardContent>
		</Card>
	);
}
