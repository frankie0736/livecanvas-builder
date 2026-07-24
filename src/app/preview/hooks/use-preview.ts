import { TaskStatusRequestError, fetchTaskStatus } from "@/lib/task-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { processCss } from "../utils/css-processor";

// Device configuration
export type DeviceType = "mobile" | "tablet" | "desktop";

export const deviceConfigs = {
	mobile: { width: "375px", height: "667px", label: "Mobile" },
	tablet: { width: "768px", height: "1024px", label: "Tablet" },
	desktop: { width: "100%", height: "auto", label: "Desktop" },
};

export type PreviewState =
	| { kind: "loading"; title: string; message: string }
	| { kind: "ready" }
	| { kind: "unavailable"; title: string; message: string };

export function usePreview(taskId?: string) {
	const [htmlContent, setHtmlContent] = useState<string>("");
	const [iframeContent, setIframeContent] = useState<string>("");
	const [device, setDevice] = useState<DeviceType>("desktop");
	const [iframeHeight, setIframeHeight] = useState<number>(600);
	const [uniqueKey, _setUniqueKey] = useState<number>(Date.now());
	const [customCss, setCustomCss] = useState<string | null>(null);
	const [showCssMissingDialog, setShowCssMissingDialog] = useState(false);
	const [availableThemes, setAvailableThemes] = useState<string[]>([]);
	const [currentTheme, setCurrentTheme] = useState<string | null>(null);
	const [hasDataTheme, setHasDataTheme] = useState(false);
	const [previewState, setPreviewState] = useState<PreviewState>({
		kind: "loading",
		title: "正在加载预览",
		message: "正在读取生成结果。",
	});
	const iframeRef = useRef<HTMLIFrameElement>(null);

	// Detect if HTML contains data-theme
	const detectDataTheme = useCallback((html: string) => {
		const hasDataThemeAttr = /<[^>]+data-theme=/i.test(html);
		setHasDataTheme(hasDataThemeAttr);
		if (!hasDataThemeAttr) {
			setCurrentTheme(null);
			return;
		}

		// Try to extract the current theme from the HTML
		// First check for data-theme in html tag
		let match = html.match(/<html[^>]*data-theme=["']([^"']+)["']/i);

		// If not found in html tag, check for body tag
		if (!match) {
			match = html.match(/<body[^>]*data-theme=["']([^"']+)["']/i);
		}

		// Check other elements if not found in html or body
		if (!match) {
			match = html.match(/data-theme=["']([^"']+)["']/i);
		}

		if (match?.[1]) {
			setCurrentTheme(match[1]);
		}
	}, []);

	const processHtml = useCallback(
		(html: string) => {
			try {
				// Process CSS from customCss using our utility function
				const { daisyThemeVars, tailwindDirectives, fontImports, themeNames } =
					processCss(customCss);

				// Update available themes
				if (themeNames.length > 0) {
					setAvailableThemes(themeNames);
				}

				// Generate font link tags
				const fontLinkTags = fontImports
					.map((url) => `<link href="${url}" rel="stylesheet">`)
					.join("\n  ");

				// Get the animation initialization script
				// const taosScript = createTaosInitScript()
				const taosScript = "";

				// Create a complete HTML document with the necessary libraries
				const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DaisyUI Preview</title>
  <link href="https://cdn.jsdelivr.net/npm/daisyui@5" rel="stylesheet" type="text/css" />
  <!-- <script src="https://unpkg.com/taos@1.0.5/dist/taos.js"></script> -->
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  ${fontLinkTags ? fontLinkTags : ""}
  ${
		daisyThemeVars
			? `<style id="daisy-theme-vars">\n${daisyThemeVars}\n</style>`
			: ""
	}
  <style type="text/tailwindcss">
  ${tailwindDirectives}
  </style>
  <script>
    // Calculate and send height to parent window
    function updateHeight() {
      const height = document.body.scrollHeight;
      window.parent.postMessage({ type: 'resize', height }, '*');
    }
    
    window.addEventListener('load', updateHeight);
    window.addEventListener('resize', updateHeight);
    
    // Respond to size check request
    window.addEventListener('message', function(e) {
      if (e.data === 'checkSize') {
        updateHeight();
      }
    });

    ${taosScript}
  </script>
</head>
<body>
  ${html}
</body>
</html>
    `;
				setIframeContent(fullHtml);
			} catch (error) {
				console.error("Error in processHtml:", error);

				// Create appropriate error message based on error type
				let errorMessage =
					"There was an error processing the CSS or HTML content. The content may be too large or contain invalid syntax.";

				// Handle specific error for string length
				if (
					error instanceof RangeError &&
					error.message.includes("Invalid string length")
				) {
					errorMessage =
						"The CSS or HTML content is too large to process. Please reduce the size of your content.";
				}

				// Fallback to a minimal HTML when there's an error
				const fallbackHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview Error</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background-color: #f9fafb;
      color: #1f2937;
    }
    .error-container {
      text-align: center;
      padding: 2rem;
      max-width: 500px;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      background-color: white;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    }
    h1 {
      margin-top: 0;
      font-size: 1.5rem;
    }
    p {
      margin-bottom: 1.5rem;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <h1>Preview Error</h1>
    <p>${errorMessage}</p>
  </div>
</body>
</html>
      `;
				setIframeContent(fallbackHtml);
			}
		},
		[customCss],
	);

	// Change theme in HTML content
	const changeTheme = useCallback(
		(theme: string) => {
			if (!htmlContent || !hasDataTheme) return;

			setCurrentTheme(theme);

			// Update HTML content with new theme
			let updatedContent = htmlContent;

			// Replace data-theme attribute in HTML tags
			updatedContent = updatedContent.replace(
				/(data-theme=["'])([^"']+)(["'])/gi,
				`$1${theme}$3`,
			);

			// Update the HTML content state
			setHtmlContent(updatedContent);

			// Process the updated HTML
			processHtml(updatedContent);
		},
		[htmlContent, hasDataTheme, processHtml],
	);

	// Load the completed result from the owner-scoped task API.
	useEffect(() => {
		let active = true;
		setHtmlContent("");
		setIframeContent("");
		setHasDataTheme(false);
		setCurrentTheme(null);

		if (!taskId) {
			setPreviewState({
				kind: "unavailable",
				title: "缺少预览任务",
				message: "请从已完成的生成结果打开预览。",
			});
			return () => {
				active = false;
			};
		}

		setPreviewState({
			kind: "loading",
			title: "正在加载预览",
			message: "正在读取生成结果。",
		});

		void fetchTaskStatus(taskId)
			.then((task) => {
				if (!active) return;
				if (task.status === "COMPLETED") {
					const content = task.code;
					setHtmlContent(content);
					detectDataTheme(content);
					setPreviewState({ kind: "ready" });
					return;
				}
				if (task.status === "PENDING" || task.status === "RUNNING") {
					setPreviewState({
						kind: "unavailable",
						title: "生成仍在进行中",
						message: "生成完成后可从结果区打开预览。",
					});
					return;
				}
				setPreviewState({
					kind: "unavailable",
					title: "预览不可用",
					message: task.error || "该任务没有可预览的生成结果。",
				});
			})
			.catch((error: unknown) => {
				if (!active) return;
				if (error instanceof TaskStatusRequestError && error.status === 404) {
					setPreviewState({
						kind: "unavailable",
						title: "预览不可用",
						message: "任务不存在或你无权查看它。",
					});
					return;
				}
				setPreviewState({
					kind: "unavailable",
					title: "无法加载预览",
					message: "读取生成结果时出现错误，请稍后重试。",
				});
			});

		return () => {
			active = false;
		};
	}, [detectDataTheme, taskId]);

	// Load the user's CSS preference independently of the task result.
	useEffect(() => {
		// Get the user's CSS from localStorage
		const themeStore = localStorage.getItem("theme-store");
		if (themeStore) {
			try {
				const parsedStore = JSON.parse(themeStore);
				if (parsedStore.state?.generatedCSS) {
					// remove "@import 'tailwindcss';" since it's already in the head
					const cssWithoutTailwind = parsedStore.state.generatedCSS.replace(
						`@import 'tailwindcss';`,
						"",
					);
					setCustomCss(cssWithoutTailwind);
				} else {
					// No CSS in theme store
					setShowCssMissingDialog(true);
				}
			} catch (error) {
				console.error("Error parsing theme store:", error);
				setShowCssMissingDialog(true);
			}
		} else {
			// No theme store at all
			setShowCssMissingDialog(true);
		}
	}, []);

	// Process HTML with current CSS
	useEffect(() => {
		if (htmlContent) {
			processHtml(htmlContent);
		}
	}, [htmlContent, processHtml]);

	// Handle iframe height messaging
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			if (event.data && event.data.type === "resize") {
				const newHeight = Math.max(event.data.height, 600);
				setIframeHeight(newHeight);
			}
		};

		window.addEventListener("message", handleMessage);
		return () => {
			window.removeEventListener("message", handleMessage);
		};
	}, []);

	const handleCloseCssMissingDialog = () => {
		setShowCssMissingDialog(false);
	};

	// Function to get content for copy button - directly return current HTML
	const getContentToCopy = (): string => {
		return htmlContent;
	};

	return {
		htmlContent,
		iframeContent,
		device,
		iframeHeight,
		uniqueKey,
		iframeRef,
		showCssMissingDialog,
		hasDataTheme,
		availableThemes,
		currentTheme,
		previewState,
		setDevice,
		handleCloseCssMissingDialog,
		getContentToCopy,
		changeTheme,
	};
}
