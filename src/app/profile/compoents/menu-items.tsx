"use client";

import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Code, CreditCard, FileText, Star, User } from "lucide-react";

interface MenuItem {
	label: string;
	key: string;
	icon: React.ReactNode;
	value?: string;
}

const menuItems: MenuItem[] = [
	{
		label: "个人信息",
		key: "",
		icon: <User className="h-4 w-4" />,
	},
	{
		label: "API密钥",
		key: "api-keys",
		icon: <CreditCard className="h-4 w-4" />,
	},
	{
		label: "我的项目",
		key: "my-projects",
		icon: <Code className="h-4 w-4" />,
	},
	{
		label: "我的收藏",
		key: "favorites-projects",
		icon: <Star className="h-4 w-4" />,
	},
];

export function MenuItems() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const navigate = useNavigate();

	// Check if the current path matches a menu item
	const isActive = (itemKey: string) => {
		// For the root profile page (exact match)
		if (itemKey === "") {
			return pathname === "/profile" || pathname === "/profile/";
		}

		// For other menu items (exact match with their sections)
		const profilePath = `/profile/${itemKey}`;
		// Match exact section or sub-pages of that section
		return (
			pathname === profilePath ||
			(pathname.startsWith(`${profilePath}/`) && pathname !== "/profile/")
		);
	};

	return (
		<>
			{menuItems.map((item) => (
				<button
					key={item.key}
					onClick={() => {
						void navigate({
							to: item.key ? `/profile/${item.key}` : "/profile",
						});
					}}
					className={`flex w-full items-center justify-between rounded-lg p-2.5 transition-colors duration-200 ${
						isActive(item.key)
							? "bg-zinc-100 dark:bg-zinc-800"
							: "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
					}`}
					type="button"
				>
					<div className="flex items-center gap-2">
						{item.icon}
						<span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
							{item.label}
						</span>
					</div>
					{item.value && (
						<span className="text-xs text-zinc-500 dark:text-zinc-400">
							{item.value}
						</span>
					)}
				</button>
			))}
		</>
	);
}
