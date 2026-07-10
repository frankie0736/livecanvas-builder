import { ClientGallery } from "@/app/gallery/components/client-gallery";
import { GalleryLoadingProvider } from "@/app/gallery/components/gallery-loading-provider";
import GalleryLayout from "@/app/gallery/layout";
import { getGalleryData } from "@/features/projects/server-functions";
import { createFileRoute } from "@tanstack/react-router";

type GallerySearch = { page?: number; pageSize?: number; tag?: string[] };

export const Route = createFileRoute("/_protected/gallery")({
	validateSearch: (search: Record<string, unknown>): GallerySearch => ({
		page: optionalPositiveInteger(search.page),
		pageSize: optionalPositiveInteger(search.pageSize),
		tag: Array.isArray(search.tag)
			? search.tag.filter((tag): tag is string => typeof tag === "string")
			: typeof search.tag === "string"
				? [search.tag]
				: [],
	}),
	loaderDeps: ({ search }) => ({
		page: search.page ?? 1,
		pageSize: search.pageSize ?? 12,
		tag: search.tag ?? [],
	}),
	loader: ({ deps }) =>
		getGalleryData({
			data: { page: deps.page, pageSize: deps.pageSize, tags: deps.tag },
		}),
	component: GalleryRoute,
});

function optionalPositiveInteger(value: unknown) {
	const parsed = typeof value === "number" ? value : Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function GalleryRoute() {
	const data = Route.useLoaderData();
	const search = Route.useSearch();
	return (
		<GalleryLayout>
			<GalleryLoadingProvider>
				<ClientGallery
					initialProjects={data.projects}
					initialInteractions={data.interactions}
					userId={data.userId}
					isAuthenticated
					pagination={data.pagination}
					selectedTags={search.tag ?? []}
					allAvailableTags={data.allAvailableTags}
				/>
			</GalleryLoadingProvider>
		</GalleryLayout>
	);
}
