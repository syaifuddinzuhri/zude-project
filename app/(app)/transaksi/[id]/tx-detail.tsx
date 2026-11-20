"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteTxAction, duplicateTxAction, restoreTxAction } from "@/lib/actions/transactions";
import { formatLongDate } from "@/lib/finance/date";
import { BENEFICIARY_LABEL, TX_TYPE_LABEL } from "@/lib/utils";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CategoryIcon, Icon } from "@/components/ui/icon";
import { Money, TxAmount } from "@/components/ui/money";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { TransactionForm } from "@/components/transaction-form";
import { useOwnerName } from "@/components/app-data";
import type { TxKind } from "@/components/add-sheet-context";

interface View {
  id: number;
  type: string;
  amount: number;
  principal: number;
  date: string;
  time: string;
  account: string;
  accountId: number;
  toAccount: string | null;
  toAccountId: number | null;
  splits: { categoryId: number; amount: number; note: string | null; name: string; icon: string; color: string }[];
  note: string | null;
  beneficiary: string | null;
  tags: string[];
  fee: number;
  status: string;
  debtId: number | null;
  debtName: string | null;
  goalId: number | null;
  goalName: string | null;
  by: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  isFee: boolean;
  parentId: number | null;
  locked: boolean;
}

export function TxDetail({ t }: { t: View }) {
  const { names } = useOwnerName();
  const [edit, setEdit] = useState(false);
  const [askReason, setAskReason] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const dir = t.type === "income" ? "in" : t.type === "adjustment" ? (t.amount >= 0 ? "in" : "out") : t.type === "transfer" || t.type === "saving_deposit" ? "neutral" : "out";

  const remove = (why?: string) =>
    start(async () => {
      const r = await deleteTxAction(t.id, why);
      if (!r.ok) {
        if (r.locked) return setAskReason(true);
        return toast.error(r.error);
      }
      toast.success("Transaksi dihapus", { label: "Urungkan", onClick: async () => { const u = await restoreTxAction(t.id, why); if (!u.ok) toast.error(u.error); router.refresh(); } });
      router.push("/transaksi");
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <Card className="text-center">
        <div className="mb-2 flex justify-center">
          <CategoryIcon icon={t.splits[0]?.icon ?? (t.type === "transfer" ? "arrow-left-right" : t.type === "debt_payment" ? "landmark" : t.type === "saving_deposit" ? "piggy-bank" : "scale")} color={t.splits[0]?.color ?? "#2563EB"} size={56} />
        </div>
        <div className="text-caption font-semibold text-muted">{TX_TYPE_LABEL[t.type]}{t.status === "planned" ? " · terencana" : ""}{t.deleted ? " · dihapus" : ""}</div>
        <TxAmount amount={t.amount} direction={dir} className="text-[30px] leading-[38px]" />
        <div className="text-caption text-muted">{formatLongDate(t.date)} · {t.time}</div>
        {t.locked && <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-bold text-warning"><Icon name="lock" size={12} /> Bulan terkunci</div>}
      </Card>

      <Card className="divide-y divide-border/70 p-0">
        <Row label="Akun" value={t.toAccount ? `${t.account} → ${t.toAccount}` : t.account} />
        {t.splits.length > 0 && (
          <div className="px-4 py-3">
            <div className="mb-1 text-caption text-muted">{t.splits.length > 1 ? "Split kategori" : t.type === "debt_payment" ? "Bunga/biaya" : "Kategori"}</div>
            {t.splits.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-2 py-1">
                <span className="flex items-center gap-2 text-[14px]"><CategoryIcon icon={s.icon} color={s.color} size={28} /> {s.name}</span>
                <Money value={s.amount} className="text-[14px] font-semibold" />
              </div>
            ))}
          </div>
        )}
        {t.type === "debt_payment" && <Row label="Pokok" value={<Money value={t.principal} />} />}
        {t.debtName && <Row label="Hutang" value={<Link className="font-semibold text-primary" href={`/hutang/${t.debtId}`}>{t.debtName}</Link>} />}
        {t.goalName && <Row label="Tujuan" value={<Link className="font-semibold text-primary" href={`/tabungan/${t.goalId}`}>{t.goalName}</Link>} />}
        {t.fee > 0 && <Row label="Biaya admin" value={<Money value={t.fee} />} />}
        {t.note && <Row label="Catatan" value={t.note} />}
        {t.beneficiary && <Row label="Untuk" value={t.beneficiary === "suami" || t.beneficiary === "istri" ? names[t.beneficiary] : BENEFICIARY_LABEL[t.beneficiary]} />}
        {t.tags.length > 0 && <Row label="Tag" value={t.tags.map((x) => `#${x}`).join(" ")} />}
        <Row label="Pemilik akun" value={t.by} />
        <Row label="Dicatat" value={new Date(t.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} />
        {t.updatedBy && <Row label="Terakhir diubah" value={new Date(t.updatedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} />}
      </Card>

      {t.isFee ? (
        <Link href={`/transaksi/${t.parentId}`} className="block text-center text-[14px] font-semibold text-primary">Lihat transaksi transfernya →</Link>
      ) : !t.deleted ? (
        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" onClick={() => setEdit(true)} disabled={t.type === "adjustment"}>
            <Icon name="pencil" size={18} /> Ubah
          </Button>
          <Button variant="secondary" disabled={t.type === "debt_payment" || pending} onClick={() => start(async () => { const r = await duplicateTxAction(t.id); if (!r.ok) return toast.error(r.error); toast.success("Diduplikat ke hari ini"); router.push(`/transaksi/${r.data}`); })}>
            <Icon name="copy" size={18} /> Duplikat
          </Button>
          <Button variant="destructive" loading={pending} onClick={() => (t.locked ? setAskReason(true) : remove())}>
            <Icon name="trash" size={18} /> Hapus
          </Button>
        </div>
      ) : (
        <Button block onClick={() => start(async () => { const r = await restoreTxAction(t.id, reason || undefined); if (!r.ok) { if (r.locked) return setAskReason(true); return toast.error(r.error); } toast.success("Dipulihkan"); router.refresh(); })}>
          Pulihkan
        </Button>
      )}

      <BottomSheet open={askReason} onOpenChange={setAskReason} title="Bulan ini sudah dikunci" description="Perubahan di bulan terkunci wajib diberi alasan dan tercatat di log aktivitas." footer={<Button block variant="destructive" disabled={!reason.trim()} loading={pending} onClick={() => { setAskReason(false); remove(reason); }}>Hapus dengan alasan</Button>}>
        <Input autoFocus placeholder="Alasan" value={reason} onChange={(e) => setReason(e.target.value)} />
      </BottomSheet>

      <BottomSheet open={edit} onOpenChange={setEdit} full>
        {edit && (
          <TransactionForm
            initial={{
              id: t.id,
              type: (t.type === "adjustment" ? "expense" : t.type) as TxKind,
              amount: t.amount,
              accountId: t.accountId,
              toAccountId: t.toAccountId,
              splits: t.type === "debt_payment" ? [] : t.splits,
              date: t.date,
              time: t.time,
              note: t.note,
              beneficiary: t.beneficiary,
              tags: t.tags,
              feeAmount: t.fee,
              status: t.status as "planned" | "realized",
              debtId: t.debtId,
              goalId: t.goalId,
            }}
            onDone={() => setEdit(false)}
          />
        )}
      </BottomSheet>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="text-caption text-muted">{label}</span>
      <span className="text-right text-[14px] font-medium">{value}</span>
    </div>
  );
}
