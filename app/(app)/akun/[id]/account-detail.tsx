"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AccountView } from "@/lib/server/balances";
import type { TxView } from "@/lib/server/tx-list";
import { deleteAccountAction, reconcileAction } from "@/lib/actions/accounts";
import { formatRp } from "@/lib/finance/money";
import { ACCOUNT_TYPE_LABEL } from "@/lib/utils";
import { useOwnerName } from "@/components/app-data";
import { AccountForm } from "@/components/account-form";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, MoneyInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Money } from "@/components/ui/money";
import { ProgressBar } from "@/components/ui/progress";
import { TxRow } from "@/components/tx-row";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";

export function AccountDetail({ a, txs }: { a: AccountView; txs: TxView[] }) {
  const { name } = useOwnerName();
  const [sheet, setSheet] = useState<null | "edit" | "reconcile">(null);
  const [actual, setActual] = useState(Math.abs(a.balance));
  const [neg, setNeg] = useState(a.balance < 0);
  const [reason, setReason] = useState("");
  const [needReason, setNeedReason] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const target = neg ? -actual : actual;

  return (
    <div className="space-y-3">
      <Card className="hero text-white">
        <div className="relative">
          <div className="text-[13px] text-white/80">
            {ACCOUNT_TYPE_LABEL[a.type]} · {name(a.owner)}
          </div>
          <Money value={a.balance} countUp className="text-display" />
          {a.creditLimit != null && (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[12px] text-white/85">
                <span>Tagihan berjalan <Money value={a.outstanding ?? 0} short /></span>
                <span>Sisa limit <Money value={a.availableCredit ?? 0} short /></span>
              </div>
              <ProgressBar value={(a.outstanding ?? 0) / a.creditLimit} color="#fff" className="bg-white/25" />
              {(a.statementDay || a.dueDay) && <div className="mt-1 text-[12px] text-white/80">Cetak tagihan tgl {a.statementDay ?? "-"} · jatuh tempo tgl {a.dueDay ?? "-"}</div>}
            </div>
          )}
        </div>
      </Card>

      <>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => { setActual(Math.abs(a.balance)); setNeg(a.balance < 0); setSheet("reconcile"); }}>
              <Icon name="scale" size={18} /> Cocokkan saldo
            </Button>
            <Button variant="secondary" onClick={() => setSheet("edit")}>
              <Icon name="pencil" size={18} /> Ubah
            </Button>
          </div>
          <h2 className="text-h2">Transaksi</h2>
          <Card className="divide-y divide-border/70 py-1">
            {txs.length === 0 ? <p className="py-3 text-caption text-muted">Belum ada transaksi.</p> : txs.map((t) => <TxRow key={t.id} t={t} />)}
          </Card>
          <Button
            variant="ghost"
            block
            className="text-expense"
            onClick={async () => {
              const ok = await confirm(
                txs.length
                  ? { title: "Arsipkan akun?", message: "Akun ini punya transaksi, jadi diarsipkan (disembunyikan), bukan dihapus. Riwayat tetap aman.", confirmLabel: "Arsipkan", icon: "lock" }
                  : { title: `Hapus akun "${a.name}"?`, message: "Akun dihapus permanen." },
              );
              if (!ok) return;
              start(async () => {
                const r = await deleteAccountAction(a.id);
                if (!r.ok) return toast.error(r.error);
                toast.success(r.data === "archived" ? "Akun diarsipkan" : "Akun dihapus");
                router.push("/akun");
                router.refresh();
              });
            }}
          >
            {txs.length ? "Arsipkan akun" : "Hapus akun"}
          </Button>
      </>

      <BottomSheet open={sheet === "edit"} onOpenChange={(v) => !v && setSheet(null)} title="Ubah akun">
        {sheet === "edit" && <AccountForm initial={{ ...a }} onDone={() => setSheet(null)} />}
      </BottomSheet>

      <BottomSheet
        open={sheet === "reconcile"}
        onOpenChange={(v) => !v && setSheet(null)}
        title="Cocokkan saldo"
        description="Masukkan saldo nyata di bank/e-wallet. Selisihnya dicatat sebagai transaksi Penyesuaian."
        footer={
          <Button
            block
            loading={pending}
            disabled={needReason && !reason.trim()}
            onClick={() =>
              start(async () => {
                const r = await reconcileAction(a.id, target, reason || undefined);
                if (!r.ok) {
                  if (r.locked) return setNeedReason(true);
                  return toast.error(r.error);
                }
                toast.success(r.data === 0 ? "Saldo sudah cocok ✓" : `Penyesuaian ${formatRp(r.data, { sign: true })} dicatat`);
                setSheet(null);
                router.refresh();
              })
            }
          >
            Simpan penyesuaian
          </Button>
        }
      >
        <Field label="Saldo nyata">
          <MoneyInput value={actual} onChange={setActual} autoFocus />
        </Field>
        <label className="mb-2 flex min-h-[44px] items-center gap-2 text-[14px]">
          <input type="checkbox" className="h-5 w-5 accent-[var(--primary)]" checked={neg} onChange={(e) => setNeg(e.target.checked)} /> Saldo negatif
        </label>
        <p className="text-caption text-muted">
          Saldo di ZuDe {formatRp(a.balance)} → selisih <b className={target - a.balance === 0 ? "text-income" : "text-warning"}>{formatRp(target - a.balance, { sign: true })}</b>
        </p>
        {needReason && <Input className="mt-3" placeholder="Alasan (bulan terkunci)" value={reason} onChange={(e) => setReason(e.target.value)} />}
      </BottomSheet>
    </div>
  );
}
