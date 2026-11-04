-- AlterTable
ALTER TABLE `Message` ADD COLUMN `attachmentMime` VARCHAR(191) NULL,
    ADD COLUMN `attachmentName` VARCHAR(191) NULL,
    ADD COLUMN `attachmentSize` INTEGER NULL,
    ADD COLUMN `attachmentUrl` VARCHAR(600) NULL,
    ADD COLUMN `durationSec` INTEGER NULL,
    ADD COLUMN `latitude` DECIMAL(10, 7) NULL,
    ADD COLUMN `liveUntil` DATETIME(3) NULL,
    ADD COLUMN `longitude` DECIMAL(10, 7) NULL,
    ADD COLUMN `type` ENUM('TEXT', 'IMAGE', 'AUDIO', 'FILE', 'LOCATION', 'CALL') NOT NULL DEFAULT 'TEXT';

