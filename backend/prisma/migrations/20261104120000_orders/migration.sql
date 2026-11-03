-- AlterTable
ALTER TABLE `Notification` MODIFY `type` ENUM('NEW_MESSAGE', 'LISTING_APPROVED', 'LISTING_REJECTED', 'LISTING_EXPIRED', 'NEW_INQUIRY', 'REVIEW_RECEIVED', 'VERIFICATION_STATUS', 'PROMOTION_ACTIVE', 'SYSTEM_ANNOUNCEMENT', 'REPORT_UPDATE', 'ORDER_RECEIVED', 'ORDER_UPDATE') NOT NULL;

-- CreateTable
CREATE TABLE `Order` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `buyerId` INTEGER NOT NULL,
    `sellerId` INTEGER NOT NULL,
    `targetType` ENUM('LISTING', 'SERVICE', 'PROPERTY') NOT NULL,
    `targetId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `unitPrice` DECIMAL(12, 2) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'UGX',
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `message` TEXT NULL,
    `contactPhone` VARCHAR(191) NOT NULL,
    `meetingPlace` VARCHAR(191) NULL,
    `preferredDate` DATETIME(3) NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `sellerNote` TEXT NULL,
    `conversationId` INTEGER NULL,
    `respondedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Order_buyerId_status_idx`(`buyerId`, `status`),
    INDEX `Order_sellerId_status_idx`(`sellerId`, `status`),
    INDEX `Order_targetType_targetId_idx`(`targetType`, `targetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_buyerId_fkey` FOREIGN KEY (`buyerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_sellerId_fkey` FOREIGN KEY (`sellerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

