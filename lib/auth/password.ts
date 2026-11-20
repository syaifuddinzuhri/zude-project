import bcrypt from "bcryptjs";

export async function hashSecret(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifySecret(plain: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}
