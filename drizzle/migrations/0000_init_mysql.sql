CREATE TABLE `announcements` (
	`announcement_id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`title` varchar(200) NOT NULL,
	`excerpt` varchar(500),
	`body` text NOT NULL,
	`cover_image_key` varchar(255),
	`author` varchar(120),
	`is_published` boolean NOT NULL DEFAULT false,
	`published_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `announcements_announcement_id` PRIMARY KEY(`announcement_id`),
	CONSTRAINT `announcements_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `announcements_published_ck` CHECK(`announcements`.`is_published` = false or `announcements`.`published_at` is not null)
);
--> statement-breakpoint
CREATE TABLE `inquiries` (
	`inquiry_id` int AUTO_INCREMENT NOT NULL,
	`source_page` varchar(20) NOT NULL,
	`listing_id` int,
	`buyer_name` varchar(200) NOT NULL,
	`email` varchar(254) NOT NULL,
	`contact_number` varchar(50) NOT NULL,
	`company` varchar(200),
	`message` text NOT NULL,
	`inquiry_status` varchar(20) NOT NULL DEFAULT 'new',
	`user_agent` varchar(512),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inquiries_inquiry_id` PRIMARY KEY(`inquiry_id`),
	CONSTRAINT `inquiries_source_ck` CHECK(`inquiries`.`source_page` in ('home', 'product_detail', 'contact')),
	CONSTRAINT `inquiries_status_ck` CHECK(`inquiries`.`inquiry_status` in ('new', 'read', 'contacted', 'negotiating', 'won', 'lost', 'archived'))
);
--> statement-breakpoint
CREATE TABLE `listing_images` (
	`image_id` int AUTO_INCREMENT NOT NULL,
	`listing_id` int NOT NULL,
	`storage_key` varchar(255) NOT NULL,
	`alt_text` varchar(300),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_primary` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `listing_images_image_id` PRIMARY KEY(`image_id`)
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`listing_id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`category` varchar(30) NOT NULL,
	`title` varchar(200) NOT NULL,
	`reference_number` varchar(120),
	`maker` varchar(120),
	`model` varchar(120),
	`body_type` varchar(120),
	`year_of_manufacture` int,
	`mileage` int,
	`color` varchar(80),
	`location` varchar(120),
	`vehicle_condition` varchar(20),
	`transmission_type` varchar(20),
	`fuel_type` varchar(20),
	`sale_status` varchar(20) NOT NULL DEFAULT 'available',
	`price` decimal(12,2),
	`price_on_application` boolean NOT NULL DEFAULT false,
	`description` text,
	`specs` json,
	`is_featured` boolean NOT NULL DEFAULT false,
	`is_published` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `listings_listing_id` PRIMARY KEY(`listing_id`),
	CONSTRAINT `listings_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `listings_reference_number_unique` UNIQUE(`reference_number`),
	CONSTRAINT `listings_category_ck` CHECK(`listings`.`category` in ('used_car', 'used_truck', 'used_heavy_equipment')),
	CONSTRAINT `listings_status_ck` CHECK(`listings`.`sale_status` in ('available', 'reserved', 'sold', 'incoming')),
	CONSTRAINT `listings_condition_ck` CHECK(`listings`.`vehicle_condition` in ('used', 'reconditioned', 'for_parts')),
	CONSTRAINT `listings_transmission_ck` CHECK(`listings`.`transmission_type` in ('manual', 'automatic', 'semi_automatic', 'other')),
	CONSTRAINT `listings_fuel_ck` CHECK(`listings`.`fuel_type` in ('diesel', 'gasoline', 'hybrid', 'electric', 'other')),
	CONSTRAINT `listings_price_ck` CHECK(`listings`.`price` >= 0),
	CONSTRAINT `listings_price_required_ck` CHECK(`listings`.`price_on_application` = true or `listings`.`price` is not null),
	CONSTRAINT `listings_mileage_ck` CHECK(`listings`.`mileage` >= 0),
	CONSTRAINT `listings_year_ck` CHECK(`listings`.`year_of_manufacture` >= 1950)
);
--> statement-breakpoint
CREATE TABLE `spare_parts` (
	`part_id` int AUTO_INCREMENT NOT NULL,
	`part_name` varchar(200) NOT NULL,
	`part_category` varchar(120),
	`description` text,
	`price` decimal(12,2),
	`image_storage_key` varchar(255),
	`is_published` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `spare_parts_part_id` PRIMARY KEY(`part_id`),
	CONSTRAINT `spare_parts_price_ck` CHECK(`spare_parts`.`price` >= 0)
);
--> statement-breakpoint
ALTER TABLE `inquiries` ADD CONSTRAINT `inquiries_listing_id_listings_listing_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`listing_id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `listing_images` ADD CONSTRAINT `listing_images_listing_id_listings_listing_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`listing_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `announcements_published_idx` ON `announcements` (`is_published`,`published_at`);--> statement-breakpoint
CREATE INDEX `inquiries_source_status_created_idx` ON `inquiries` (`source_page`,`inquiry_status`,`created_at`);--> statement-breakpoint
CREATE INDEX `inquiries_created_at_idx` ON `inquiries` (`created_at`);--> statement-breakpoint
CREATE INDEX `listing_images_listing_sort_idx` ON `listing_images` (`listing_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `listings_category_status_idx` ON `listings` (`category`,`sale_status`);--> statement-breakpoint
CREATE INDEX `listings_is_published_idx` ON `listings` (`is_published`);--> statement-breakpoint
CREATE INDEX `spare_parts_published_sort_idx` ON `spare_parts` (`is_published`,`sort_order`);