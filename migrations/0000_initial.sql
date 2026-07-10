CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `account_provider_account_idx` ON `account` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE TABLE `favorite` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `favorite_project_id_idx` ON `favorite` (`project_id`);--> statement-breakpoint
CREATE INDEX `favorite_user_id_idx` ON `favorite` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `favorite_user_project_idx` ON `favorite` (`user_id`,`project_id`);--> statement-breakpoint
CREATE TABLE `generation_task` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workflow_instance_id` text,
	`status` text NOT NULL,
	`model` text NOT NULL,
	`encrypted_payload` text NOT NULL,
	`result` text,
	`error` text,
	`usage` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "generation_task_state_data_check" CHECK((
				("generation_task"."status" IN ('PENDING', 'RUNNING') AND "generation_task"."result" IS NULL AND "generation_task"."error" IS NULL AND "generation_task"."completed_at" IS NULL)
				OR ("generation_task"."status" = 'COMPLETED' AND "generation_task"."result" IS NOT NULL AND "generation_task"."error" IS NULL AND "generation_task"."completed_at" IS NOT NULL)
				OR ("generation_task"."status" = 'FAILED' AND "generation_task"."result" IS NULL AND "generation_task"."error" IS NOT NULL AND "generation_task"."completed_at" IS NOT NULL)
				OR ("generation_task"."status" = 'CANCELED' AND "generation_task"."result" IS NULL AND "generation_task"."completed_at" IS NOT NULL)
			))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `generation_task_workflow_instance_id_unique` ON `generation_task` (`workflow_instance_id`);--> statement-breakpoint
CREATE INDEX `generation_task_user_created_idx` ON `generation_task` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `project` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`html_content` text NOT NULL,
	`thumbnail` text,
	`tags` text DEFAULT '' NOT NULL,
	`purchase_count` integer DEFAULT 0 NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_user_id_idx` ON `project` (`user_id`);--> statement-breakpoint
CREATE INDEX `project_title_idx` ON `project` (`title`);--> statement-breakpoint
CREATE INDEX `project_published_created_idx` ON `project` (`is_published`,`created_at`);--> statement-breakpoint
CREATE TABLE `purchase` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `purchase_project_id_idx` ON `purchase` (`project_id`);--> statement-breakpoint
CREATE INDEX `purchase_user_id_idx` ON `purchase` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_user_project_idx` ON `purchase` (`user_id`,`project_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`background_info` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `verification_identifier_value_idx` ON `verification` (`identifier`,`value`);