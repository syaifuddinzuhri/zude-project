-- DropIndex
DROP INDEX `users_spouse_label_key` ON `users`;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `spouse_label`;

-- AlterTable
ALTER TABLE `accounts` DROP COLUMN `is_private`;

