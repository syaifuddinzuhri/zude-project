-- Tambah opsi "Bersama" pada Untuk siapa
ALTER TABLE `transactions` MODIFY `beneficiary` ENUM('suami', 'istri', 'anak', 'keluarga', 'bersama') NULL;
