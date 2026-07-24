import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Eye } from "lucide-react";

interface PreviewButtonProps {
	taskId: string;
}

export function PreviewButton({ taskId }: PreviewButtonProps) {
	return (
		<Button asChild variant="ghost" size="icon" className="cursor-pointer">
			<Link
				to="/preview"
				search={{ taskId }}
				target="_blank"
				rel="noopener noreferrer"
				aria-label="预览"
			>
				<Eye className="h-4 w-4" />
			</Link>
		</Button>
	);
}
