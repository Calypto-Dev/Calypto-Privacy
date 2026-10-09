CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`used` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limits_expires` ON `rate_limits` (`expires`);--> statement-breakpoint
CREATE TABLE `request_leases` (
	`key` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `request_leases_expires` ON `request_leases` (`expires`);--> statement-breakpoint
CREATE INDEX `conversations_wallet` ON `conversations` (`wallet`);--> statement-breakpoint
CREATE INDEX `conversations_owner_wallet` ON `conversations` (`owner`,`wallet`);