export type TxType = "income" | "expense" | "transfer" | "debt_payment" | "saving_deposit" | "adjustment";

export interface TxLike {
  type: TxType;
  accountId: number;
  toAccountId: number | null;
  amount: number;
  status?: "planned" | "realized";
  deletedAt?: Date | string | null;
}

/** Efek satu transaksi terhadap saldo akun `accountId`. */
export function txEffect(tx: TxLike, accountId: number): number {
  if (tx.deletedAt) return 0;
  if (tx.status && tx.status !== "realized") return 0;
  let e = 0;
  if (tx.accountId === accountId) {
    switch (tx.type) {
      case "income":
        e += tx.amount;
        break;
      case "adjustment":
        e += tx.amount; // bertanda
        break;
      case "expense":
      case "debt_payment":
      case "transfer":
      case "saving_deposit":
        e -= tx.amount;
        break;
    }
  }
  if (tx.toAccountId === accountId && (tx.type === "transfer" || tx.type === "saving_deposit")) {
    e += tx.amount;
  }
  return e;
}

/** Saldo = saldo awal + Σ efek transaksi realized yang tidak terhapus. */
export function computeBalance(openingBalance: number, accountId: number, txs: TxLike[]): number {
  return txs.reduce((bal, tx) => bal + txEffect(tx, accountId), openingBalance);
}

export function computeBalances(
  accounts: { id: number; openingBalance: number }[],
  txs: TxLike[],
): Map<number, number> {
  const map = new Map<number, number>(accounts.map((a) => [a.id, a.openingBalance]));
  for (const tx of txs) {
    if (map.has(tx.accountId)) map.set(tx.accountId, map.get(tx.accountId)! + txEffect({ ...tx, toAccountId: null }, tx.accountId));
    // Setoran ke akun yang sama (alokasi virtual) otomatis netral: −a + a = 0
    if (tx.toAccountId != null && map.has(tx.toAccountId)) {
      map.set(tx.toAccountId, map.get(tx.toAccountId)! + txEffect({ ...tx, accountId: -1 }, tx.toAccountId));
    }
  }
  return map;
}

/** Nominal transaksi penyesuaian agar saldo website = saldo nyata. 0 bila sudah cocok. */
export function adjustmentFor(currentBalance: number, actualBalance: number): number {
  return actualBalance - currentBalance;
}

/** Kartu kredit: saldo negatif = tagihan berjalan. */
export function creditCardStatus(balance: number, limit: number | null) {
  const outstanding = Math.max(0, -balance);
  return { outstanding, available: limit != null ? Math.max(0, limit - outstanding) : null };
}
