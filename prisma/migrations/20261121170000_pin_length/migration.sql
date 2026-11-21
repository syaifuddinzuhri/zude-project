-- Jumlah digit PIN untuk layar masuk
ALTER TABLE `users` ADD COLUMN `pin_length` TINYINT NULL;
