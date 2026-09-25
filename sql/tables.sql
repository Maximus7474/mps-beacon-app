CREATE TABLE IF NOT EXISTS `beacon_announcements` (
  `id` VARCHAR(40) NOT NULL,
  `company_id` VARCHAR(40) NOT NULL,
  `type` ENUM('status', 'offer', 'general') NOT NULL DEFAULT 'general',
  `title` VARCHAR(80) NOT NULL,
  `content` VARCHAR(400) NOT NULL,
  `created_at` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  KEY `beacon_announcements_company` (`company_id`),
  KEY `beacon_announcements_recent` (`created_at`)
);

CREATE TABLE IF NOT EXISTS `beacon_posts` (
  `id` VARCHAR(40) NOT NULL,
  `company_id` VARCHAR(40) NOT NULL,
  `type` ENUM('post', 'menu') NOT NULL DEFAULT 'post',
  `title` VARCHAR(80) NOT NULL,
  `content` VARCHAR(400) NOT NULL,
  `price` VARCHAR(16) DEFAULT NULL,
  `badge` VARCHAR(16) DEFAULT NULL,
  `created_at` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  KEY `beacon_posts_company` (`company_id`),
  KEY `beacon_posts_recent` (`created_at`)
);

CREATE TABLE IF NOT EXISTS `beacon_channels` (
  `id` VARCHAR(64) NOT NULL,
  `company_id` VARCHAR(40) NOT NULL,
  `phone_number` VARCHAR(15) NOT NULL DEFAULT '',
  `last_message_preview` VARCHAR(120) NOT NULL DEFAULT '',
  `last_message_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `unread_user` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `unread_company` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `beacon_channels_conversation` (`company_id`, `phone_number`),
  KEY `beacon_channels_recent` (`last_message_at`)
);

CREATE TABLE IF NOT EXISTS `beacon_messages` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `channel_id` VARCHAR(64) NOT NULL,
  `author` ENUM('user', 'employee') NOT NULL,
  `sent_by` VARCHAR(64) DEFAULT NULL,
  `content` VARCHAR(400) NOT NULL,
  `created_at` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  KEY `beacon_messages_channel` (`channel_id`, `created_at`)
);
