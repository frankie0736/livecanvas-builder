export const GUEST_ROUTES = ["/", "/signin"] as const;

export const PUBLIC_ROUTES = ["/terms-of-service", "/privacy-policy"] as const;

export const PROTECTED_ROUTES = [
	"/chat",
	"/dashboard",
	"/example",
	"/gallery",
	"/preview",
	"/profile",
	"/profile/api-keys",
	"/profile/favorites-projects",
	"/profile/my-projects",
	"/signout",
	"/wizard",
] as const;

export const API_ROUTES = [
	"/api/auth/$",
	"/api/chat",
	"/api/metadata",
	"/api/models/aihubmix",
	"/api/task/cancel",
	"/api/task/status",
	"/api/task/submit",
] as const;

export const APP_ROUTES = [
	...GUEST_ROUTES,
	...PUBLIC_ROUTES,
	...PROTECTED_ROUTES,
	...API_ROUTES,
] as const;

export const WORKER_BINDINGS = ["DB", "ASSETS", "CHAT_GENERATION"] as const;
