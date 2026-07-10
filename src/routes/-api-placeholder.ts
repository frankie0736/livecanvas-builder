export function migrationApiPlaceholder() {
	return Response.json(
		{ error: "Migration route not implemented" },
		{ status: 501 },
	);
}
