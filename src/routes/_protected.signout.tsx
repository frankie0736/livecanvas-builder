import { authClient } from "@/lib/auth-client";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_protected/signout")({
	component: SignOut,
});

function SignOut() {
	const navigate = useNavigate();
	useEffect(() => {
		void authClient.signOut({
			fetchOptions: {
				onSuccess: () => navigate({ to: "/signin" }),
			},
		});
	}, [navigate]);
	return <p className="p-6 text-center text-muted-foreground">正在退出...</p>;
}
