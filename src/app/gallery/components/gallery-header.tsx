"use client";

import { Badge } from "@/components/ui/badge";
import { useNavigate } from "@tanstack/react-router";
import { useGalleryLoading } from "./gallery-loading-provider";

interface GalleryHeaderProps {
	selectedTags: string[];
	setSelectedTags: (tags: string[]) => void;
	availableTags: string[];
}

export function GalleryHeader({
	selectedTags,
	setSelectedTags,
	availableTags,
}: GalleryHeaderProps) {
	const navigate = useNavigate();
	const { startNavigation } = useGalleryLoading();

	const updateTags = (tags: string[]) => {
		setSelectedTags(tags);
		startNavigation(() => {
			void navigate({
				to: "/gallery",
				search: (current) => ({ ...current, page: 1, tag: tags }),
			});
		});
	};

	return (
		<div className="mt-4">
			<div className="flex flex-wrap items-center gap-2">
				{availableTags.map((tag) => {
					const isSelected = selectedTags.includes(tag);
					return (
						<Badge
							key={tag}
							variant={isSelected ? "default" : "outline"}
							className={`cursor-pointer transition-colors ${
								isSelected
									? "hover:bg-primary/90 dark:hover:bg-primary/90"
									: "hover:bg-zinc-100 dark:hover:bg-zinc-800"
							}`}
							onClick={() =>
								updateTags(
									isSelected
										? selectedTags.filter((selected) => selected !== tag)
										: [...selectedTags, tag],
								)
							}
						>
							{tag}
						</Badge>
					);
				})}
				{selectedTags.length > 0 && (
					<button
						type="button"
						className="ml-2 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
						onClick={() => updateTags([])}
					>
						Clear all
					</button>
				)}
			</div>
		</div>
	);
}
