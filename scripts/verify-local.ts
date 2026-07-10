const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:5173";

async function request(path: string, init?: RequestInit) {
	const response = await fetch(new URL(path, baseUrl), {
		...init,
		redirect: "manual",
	});
	return { response, body: await response.text() };
}

const root = await request("/");
if (root.response.status !== 200 || !root.body.includes("LiveCanvas Builder")) {
	throw new Error("Public root verification failed");
}
const signIn = await request("/signin");
if (signIn.response.status !== 200 || !signIn.body.includes("欢迎回来")) {
	throw new Error("Sign-in verification failed");
}
const protectedRoute = await request("/dashboard");
if (![301, 302, 303, 307, 308].includes(protectedRoute.response.status)) {
	throw new Error("Protected redirect verification failed");
}
const missingMedia = await request("/api/media/missing-object");
if (missingMedia.response.status !== 404) {
	throw new Error("R2 media boundary verification failed");
}
const taskStatus = await request("/api/task/status?taskId=missing");
if (taskStatus.response.status !== 401) {
	throw new Error("Task authorization verification failed");
}

console.log(
	JSON.stringify({
		event: "local_verification_complete",
		checks: 5,
		base_url: baseUrl,
	}),
);
