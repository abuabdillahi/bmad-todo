CREATE TABLE `todos` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
