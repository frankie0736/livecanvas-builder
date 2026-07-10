"use client";

import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useGalleryLoading } from "./gallery-loading-provider";

interface PaginationData {
	page: number;
	pageSize: number;
	totalCount: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
}

export function GalleryPagination({
	pagination,
}: { pagination: PaginationData }) {
	const navigate = useNavigate();
	const { startNavigation } = useGalleryLoading();
	const changePage = (page: number) =>
		startNavigation(() => {
			void navigate({
				to: "/gallery",
				search: (current) => ({ ...current, page }),
			});
		});

	if (pagination.totalPages <= 1) return null;
	return (
		<div className="mt-8 flex items-center justify-center gap-2">
			<Button
				variant="outline"
				size="sm"
				onClick={() => changePage(pagination.page - 1)}
				disabled={!pagination.hasPrevPage}
			>
				<ChevronLeft className="mr-1 h-4 w-4" />
				Previous
			</Button>
			<div className="mx-4 text-sm">
				Page {pagination.page} of {pagination.totalPages}
			</div>
			<Button
				variant="outline"
				size="sm"
				onClick={() => changePage(pagination.page + 1)}
				disabled={!pagination.hasNextPage}
			>
				Next
				<ChevronRight className="ml-1 h-4 w-4" />
			</Button>
		</div>
	);
}
