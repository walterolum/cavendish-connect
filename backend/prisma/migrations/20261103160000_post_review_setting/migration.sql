-- New posts go live immediately unless an admin switches review back on.
INSERT IGNORE INTO `SystemSetting` (`key`, `value`, `group`, `type`, `updatedAt`)
VALUES ('moderation.require_review', 'false', 'listings', 'boolean', CURRENT_TIMESTAMP(3));
