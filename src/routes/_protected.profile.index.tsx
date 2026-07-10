import ProfilePage from "@/app/profile/page";
import { getProfile } from "@/features/projects/server-functions";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/profile/")({
	loader: () => getProfile(),
	component: ProfileRoute,
});

function ProfileRoute() {
	const user = Route.useLoaderData();
	if (!user) return null;
	return <ProfilePage user={user} />;
}
