import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { EditProfileDialog } from "./compoents/edit-profile-dialog";

export interface ProfileUser {
	id: string;
	name: string;
	email: string;
	image: string | null;
	backgroundInfo: string | null;
}

export default function ProfilePage({ user }: { user: ProfileUser }) {
	return (
		<Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
			<CardHeader className="flex flex-row items-center justify-between">
				<div>
					<CardTitle>个人信息</CardTitle>
					<CardDescription>查看和管理你的个人信息</CardDescription>
				</div>
				<EditProfileDialog session={{ user }} />
			</CardHeader>
			<CardContent className="space-y-6">
				<div>
					<h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
						基本信息
					</h3>
					<div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
							<p className="text-sm text-zinc-500 dark:text-zinc-400">姓名</p>
							<p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
								{user.name}
							</p>
						</div>
						<div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
							<p className="text-sm text-zinc-500 dark:text-zinc-400">
								电子邮件（暂不支持修改）
							</p>
							<p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
								{user.email}
							</p>
						</div>
					</div>
				</div>
				<div>
					<h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
						背景信息
					</h3>
					<div className="mt-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
						{user.backgroundInfo ? (
							<pre className="whitespace-pre-wrap font-medium text-sm text-zinc-500 dark:text-zinc-100">
								{user.backgroundInfo}
							</pre>
						) : (
							<p className="font-medium text-zinc-500 dark:text-zinc-100">
								尚未添加背景信息。点击&quot;编辑资料&quot;按钮添加你的背景信息，以便AI更好地理解你的需求。
							</p>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
