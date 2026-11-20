-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `spouse_label` ENUM('suami', 'istri') NOT NULL,
    `pin_hash` VARCHAR(255) NULL,
    `totp_secret` VARCHAR(64) NULL,
    `totp_enabled` BOOLEAN NOT NULL DEFAULT false,
    `theme` VARCHAR(10) NOT NULL DEFAULT 'system',
    `quiet_start` VARCHAR(5) NOT NULL DEFAULT '22:00',
    `quiet_end` VARCHAR(5) NOT NULL DEFAULT '06:00',
    `hide_amount_in_push` BOOLEAN NOT NULL DEFAULT false,
    `daily_reminder_time` VARCHAR(5) NOT NULL DEFAULT '20:00',
    `last_account_id` INTEGER NULL,
    `session_version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_spouse_label_key`(`spouse_label`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `household_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `cycle_mode` ENUM('husband_payday', 'wife_payday', 'manual') NOT NULL DEFAULT 'manual',
    `cycle_start_day` INTEGER NOT NULL DEFAULT 1,
    `husband_payday` INTEGER NOT NULL DEFAULT 25,
    `wife_payday` INTEGER NOT NULL DEFAULT 25,
    `husband_salary` BIGINT NOT NULL DEFAULT 0,
    `wife_salary` BIGINT NOT NULL DEFAULT 0,
    `husband_salary_account_id` INTEGER NULL,
    `wife_salary_account_id` INTEGER NULL,
    `husband_template_id` INTEGER NULL,
    `wife_template_id` INTEGER NULL,
    `payday_weekend_rule` BOOLEAN NOT NULL DEFAULT false,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'IDR',
    `big_expense_threshold` BIGINT NOT NULL DEFAULT 2000000,
    `emergency_months` INTEGER NOT NULL DEFAULT 6,
    `ratio_needs` INTEGER NOT NULL DEFAULT 50,
    `ratio_wants` INTEGER NOT NULL DEFAULT 30,
    `ratio_savings` INTEGER NOT NULL DEFAULT 20,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accounts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `type` ENUM('bank', 'ewallet', 'cash', 'credit_card', 'paylater', 'investment', 'receivable') NOT NULL,
    `owner` ENUM('suami', 'istri', 'bersama') NOT NULL,
    `opening_balance` BIGINT NOT NULL DEFAULT 0,
    `opening_date` DATE NOT NULL,
    `is_private` BOOLEAN NOT NULL DEFAULT false,
    `is_archived` BOOLEAN NOT NULL DEFAULT false,
    `include_in_networth` BOOLEAN NOT NULL DEFAULT true,
    `credit_limit` BIGINT NULL,
    `statement_day` INTEGER NULL,
    `due_day` INTEGER NULL,
    `color` VARCHAR(9) NOT NULL DEFAULT '#14B8A6',
    `icon` VARCHAR(32) NOT NULL DEFAULT 'wallet',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `parent_id` INTEGER NULL,
    `name` VARCHAR(80) NOT NULL,
    `kind` ENUM('income', 'expense') NOT NULL,
    `nature` ENUM('needs', 'wants', 'savings_debt') NULL,
    `icon` VARCHAR(32) NOT NULL DEFAULT 'circle',
    `color` VARCHAR(9) NOT NULL DEFAULT '#94A3B8',
    `is_archived` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `system_key` VARCHAR(40) NULL,

    UNIQUE INDEX `categories_system_key_key`(`system_key`),
    INDEX `categories_parent_id_idx`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `time` VARCHAR(5) NOT NULL DEFAULT '00:00',
    `type` ENUM('income', 'expense', 'transfer', 'debt_payment', 'saving_deposit', 'adjustment') NOT NULL,
    `account_id` INTEGER NOT NULL,
    `to_account_id` INTEGER NULL,
    `amount` BIGINT NOT NULL,
    `fee_amount` BIGINT NOT NULL DEFAULT 0,
    `principal_amount` BIGINT NOT NULL DEFAULT 0,
    `note` VARCHAR(255) NULL,
    `beneficiary` ENUM('suami', 'istri', 'anak', 'keluarga') NULL,
    `status` ENUM('planned', 'realized') NOT NULL DEFAULT 'realized',
    `recurring_id` INTEGER NULL,
    `recurring_due_date` DATE NULL,
    `debt_id` INTEGER NULL,
    `goal_id` INTEGER NULL,
    `parent_id` INTEGER NULL,
    `created_by` INTEGER NOT NULL,
    `updated_by` INTEGER NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `transactions_date_idx`(`date`),
    INDEX `transactions_account_id_date_idx`(`account_id`, `date`),
    INDEX `transactions_to_account_id_idx`(`to_account_id`),
    INDEX `transactions_deleted_at_idx`(`deleted_at`),
    INDEX `transactions_recurring_id_recurring_due_date_idx`(`recurring_id`, `recurring_due_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transaction_splits` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transaction_id` INTEGER NOT NULL,
    `category_id` INTEGER NOT NULL,
    `amount` BIGINT NOT NULL,
    `note` VARCHAR(255) NULL,

    INDEX `transaction_splits_category_id_idx`(`category_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tags` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(40) NOT NULL,

    UNIQUE INDEX `tags_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transaction_tags` (
    `transaction_id` INTEGER NOT NULL,
    `tag_id` INTEGER NOT NULL,

    PRIMARY KEY (`transaction_id`, `tag_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recurring_rules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `template_json` JSON NOT NULL,
    `frequency` ENUM('daily', 'weekly', 'monthly', 'last_workday', 'yearly', 'every_n_months') NOT NULL,
    `interval` INTEGER NOT NULL DEFAULT 1,
    `day_of_month` INTEGER NULL,
    `day_of_week` INTEGER NULL,
    `month_of_year` INTEGER NULL,
    `start_date` DATE NOT NULL,
    `next_run_date` DATE NOT NULL,
    `mode` ENUM('auto', 'confirm') NOT NULL DEFAULT 'confirm',
    `end_date` DATE NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `budget_periods` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `period_start` DATE NOT NULL,
    `period_end` DATE NOT NULL,
    `planned_income` BIGINT NOT NULL DEFAULT 0,
    `status` ENUM('open', 'closed', 'locked') NOT NULL DEFAULT 'open',
    `closed_at` DATETIME(3) NULL,
    `closed_by` INTEGER NULL,
    `snapshot_json` JSON NULL,

    UNIQUE INDEX `budget_periods_period_start_key`(`period_start`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `budgets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `period_id` INTEGER NOT NULL,
    `category_id` INTEGER NULL,
    `goal_id` INTEGER NULL,
    `debt_id` INTEGER NULL,
    `amount` BIGINT NOT NULL,
    `rollover_enabled` BOOLEAN NOT NULL DEFAULT false,
    `rollover_amount` BIGINT NOT NULL DEFAULT 0,

    UNIQUE INDEX `budgets_period_id_category_id_goal_id_debt_id_key`(`period_id`, `category_id`, `goal_id`, `debt_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `budget_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `items_json` JSON NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sinking_funds` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `category_id` INTEGER NOT NULL,
    `annual_amount` BIGINT NOT NULL,
    `due_month` INTEGER NOT NULL,
    `account_id` INTEGER NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `allocation_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `trigger` ENUM('salary', 'bonus', 'manual') NOT NULL,
    `items_json` JSON NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `goals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `target_amount` BIGINT NOT NULL,
    `target_date` DATE NULL,
    `account_id` INTEGER NULL,
    `owner` ENUM('suami', 'istri', 'bersama') NOT NULL DEFAULT 'bersama',
    `priority` INTEGER NOT NULL DEFAULT 3,
    `icon` VARCHAR(16) NOT NULL DEFAULT '🎯',
    `is_achieved` BOOLEAN NOT NULL DEFAULT false,
    `is_emergency` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `goal_allocations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `goal_id` INTEGER NOT NULL,
    `transaction_id` INTEGER NULL,
    `amount` BIGINT NOT NULL,
    `date` DATE NOT NULL,
    `note` VARCHAR(255) NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `goal_allocations_goal_id_date_idx`(`goal_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `debts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `lender` VARCHAR(80) NOT NULL,
    `type` ENUM('kpr', 'kendaraan', 'kta', 'kartu_kredit', 'paylater', 'pinjol', 'keluarga', 'cicilan_barang', 'lainnya') NOT NULL,
    `borrower` ENUM('suami', 'istri', 'bersama') NOT NULL,
    `principal` BIGINT NOT NULL,
    `opening_paid_principal` BIGINT NOT NULL DEFAULT 0,
    `start_date` DATE NOT NULL,
    `tenor_months` INTEGER NOT NULL,
    `interest_type` ENUM('flat', 'annuity', 'floating', 'zero') NOT NULL,
    `interest_rate_bp` INTEGER NOT NULL DEFAULT 0,
    `installment_amount` BIGINT NOT NULL DEFAULT 0,
    `due_day` INTEGER NOT NULL,
    `late_fee` BIGINT NOT NULL DEFAULT 0,
    `default_account_id` INTEGER NULL,
    `status` ENUM('active', 'paid_off') NOT NULL DEFAULT 'active',
    `note` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `debt_rate_changes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `debt_id` INTEGER NOT NULL,
    `effective_date` DATE NOT NULL,
    `interest_rate_bp` INTEGER NOT NULL,

    INDEX `debt_rate_changes_debt_id_effective_date_idx`(`debt_id`, `effective_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `debt_schedule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `debt_id` INTEGER NOT NULL,
    `period_no` INTEGER NOT NULL,
    `due_date` DATE NOT NULL,
    `principal_part` BIGINT NOT NULL,
    `interest_part` BIGINT NOT NULL,
    `total` BIGINT NOT NULL,
    `remaining_principal` BIGINT NOT NULL,
    `status` ENUM('unpaid', 'paid', 'late') NOT NULL DEFAULT 'unpaid',
    `payment_transaction_id` INTEGER NULL,

    UNIQUE INDEX `debt_schedule_debt_id_period_no_key`(`debt_id`, `period_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receivables` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `debtor_name` VARCHAR(80) NOT NULL,
    `amount` BIGINT NOT NULL,
    `paid_amount` BIGINT NOT NULL DEFAULT 0,
    `date` DATE NOT NULL,
    `promised_date` DATE NULL,
    `status` ENUM('open', 'paid') NOT NULL DEFAULT 'open',
    `note` VARCHAR(255) NULL,
    `history_json` JSON NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `type` ENUM('property', 'vehicle', 'gold', 'mutual_fund', 'stock', 'crypto', 'pension', 'other') NOT NULL,
    `owner` ENUM('suami', 'istri', 'bersama') NOT NULL DEFAULT 'bersama',
    `unit` VARCHAR(16) NULL,
    `quantity` DECIMAL(18, 4) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_valuations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_id` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `value` BIGINT NOT NULL,

    INDEX `asset_valuations_asset_id_date_idx`(`asset_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `body` VARCHAR(255) NOT NULL,
    `payload_json` JSON NULL,
    `url` VARCHAR(255) NULL,
    `dedupe_key` VARCHAR(120) NULL,
    `read_at` DATETIME(3) NULL,
    `pushed_at` DATETIME(3) NULL,
    `push_after` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_read_at_idx`(`user_id`, `read_at`),
    UNIQUE INDEX `notifications_user_id_dedupe_key_key`(`user_id`, `dedupe_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `push_subscriptions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `endpoint` VARCHAR(512) NOT NULL,
    `p256dh` VARCHAR(255) NOT NULL,
    `auth` VARCHAR(255) NOT NULL,
    `user_agent` VARCHAR(255) NULL,
    `device_label` VARCHAR(80) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_success_at` DATETIME(3) NULL,
    `failed_count` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `push_subscriptions_endpoint_key`(`endpoint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_prefs` (
    `user_id` INTEGER NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `push_enabled` BOOLEAN NOT NULL DEFAULT true,
    `inapp_enabled` BOOLEAN NOT NULL DEFAULT true,
    `email_enabled` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`user_id`, `type`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `entity` VARCHAR(40) NOT NULL,
    `entity_id` VARCHAR(40) NULL,
    `action` VARCHAR(20) NOT NULL,
    `before_json` JSON NULL,
    `after_json` JSON NULL,
    `reason` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_entity_entity_id_idx`(`entity`, `entity_id`),
    INDEX `audit_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_to_account_id_fkey` FOREIGN KEY (`to_account_id`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_recurring_id_fkey` FOREIGN KEY (`recurring_id`) REFERENCES `recurring_rules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_debt_id_fkey` FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_goal_id_fkey` FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transaction_splits` ADD CONSTRAINT `transaction_splits_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transaction_splits` ADD CONSTRAINT `transaction_splits_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transaction_tags` ADD CONSTRAINT `transaction_tags_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transaction_tags` ADD CONSTRAINT `transaction_tags_tag_id_fkey` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `budgets` ADD CONSTRAINT `budgets_period_id_fkey` FOREIGN KEY (`period_id`) REFERENCES `budget_periods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `budgets` ADD CONSTRAINT `budgets_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `budgets` ADD CONSTRAINT `budgets_goal_id_fkey` FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `budgets` ADD CONSTRAINT `budgets_debt_id_fkey` FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sinking_funds` ADD CONSTRAINT `sinking_funds_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sinking_funds` ADD CONSTRAINT `sinking_funds_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goals` ADD CONSTRAINT `goals_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goal_allocations` ADD CONSTRAINT `goal_allocations_goal_id_fkey` FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goal_allocations` ADD CONSTRAINT `goal_allocations_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `debts` ADD CONSTRAINT `debts_default_account_id_fkey` FOREIGN KEY (`default_account_id`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `debt_rate_changes` ADD CONSTRAINT `debt_rate_changes_debt_id_fkey` FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `debt_schedule` ADD CONSTRAINT `debt_schedule_debt_id_fkey` FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `debt_schedule` ADD CONSTRAINT `debt_schedule_payment_transaction_id_fkey` FOREIGN KEY (`payment_transaction_id`) REFERENCES `transactions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_valuations` ADD CONSTRAINT `asset_valuations_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `push_subscriptions` ADD CONSTRAINT `push_subscriptions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_prefs` ADD CONSTRAINT `notification_prefs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
