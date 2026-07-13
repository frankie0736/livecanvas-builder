import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { authClient } from "@/lib/auth-client";
import { Link } from "@tanstack/react-router";
import { User } from "lucide-react";

interface UserAuthMenuProps {
	session: typeof authClient.$Infer.Session | null;
}

export function UserAuthMenu({ session }: UserAuthMenuProps) {
	if (session) {
		return (
			<Button
				variant="ghost"
				className="relative h-9 w-9 rounded-full p-0"
				asChild
			>
				<Link to="/profile">
					<Avatar className="h-9 w-9">
						{session.user.image ? (
							<AvatarImage
								src={session.user.image}
								alt={session.user.name || "User"}
							/>
						) : (
							<AvatarFallback className="bg-primary text-primary-foreground">
								{session.user.name?.charAt(0) ||
									session.user.email?.charAt(0) ||
									"U"}
							</AvatarFallback>
						)}
					</Avatar>
				</Link>
			</Button>
		);
	}

	return (
		<Button variant="outline" size="sm" className="gap-2" asChild>
			<Link to="/signin">
				<User className="h-4 w-4" />
				<span>登录</span>
			</Link>
		</Button>
	);
}
