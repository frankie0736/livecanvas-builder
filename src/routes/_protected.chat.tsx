import ChatLayout from "@/app/chat/layout";
import ChatPage from "@/app/chat/page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/chat")({
	component: () => (
		<ChatLayout>
			<ChatPage />
		</ChatLayout>
	),
});
