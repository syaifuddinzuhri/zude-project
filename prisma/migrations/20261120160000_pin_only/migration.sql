-- DropIndex
DROP INDEX `users_email_key` ON `users`;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `email`,
    DROP COLUMN `password_hash`,
    DROP COLUMN `totp_enabled`,
    DROP COLUMN `totp_secret`,
    MODIFY `name` VARCHAR(80) NOT NULL DEFAULT 'Smart Money Management';

