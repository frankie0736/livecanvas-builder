"use client";

import { Button } from "@/components/ui/button";
import { Link, useRouterState } from "@tanstack/react-router";
import { GalleryHorizontal, Home, MessageSquare, Palette } from "lucide-react";

export function NavItems() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	const isActive = (path: string) => {
		return pathname === path || pathname.startsWith(`${path}/`);
	};
	return (
		<div className="hidden items-center space-x-1 md:flex">
			<Link to="/dashboard">
				<Button
					variant={isActive("/dashboard") ? "default" : "ghost"}
					className="flex items-center gap-2"
					size="sm"
				>
					<Home className="h-4 w-4" />
					<span>首页</span>
				</Button>
			</Link>
			<Link to="/gallery">
				<Button
					variant={isActive("/gallery") ? "default" : "ghost"}
					className="flex items-center gap-2"
					size="sm"
				>
					<GalleryHorizontal className="h-4 w-4" />
					<span>作品集</span>
				</Button>
			</Link>
			<Link to="/wizard">
				<Button
					variant={isActive("/wizard") ? "default" : "ghost"}
					className="flex items-center gap-2"
					size="sm"
				>
					<Palette className="h-4 w-4" />
					<span>调样式</span>
				</Button>
			</Link>
			<Link to="/chat">
				<Button
					variant={isActive("/chat") ? "default" : "ghost"}
					className="flex items-center gap-2"
					size="sm"
				>
					<MessageSquare className="h-4 w-4" />
					<span>小工具</span>
				</Button>
			</Link>
		</div>
	);
}
