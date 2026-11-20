"use client";
import Link from "next/link";
import { useState } from "react";
import type { AccountView } from "@/lib/server/balances";
import { ACCOUNT_TYPE_LABEL } from "@/lib/utils";
import { useOwnerName } from "@/components/app-data";
import { AccountForm } from "@/components/account-form";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CategoryIcon, Icon } from "@/components/ui/icon";
import { Money } from "@/components/ui/money";
import { EmptyState } from "@/components/ui/empty-state";

export function AccountsView({ accounts, openNew, showArchived }: { accounts: AccountView[]; openNew: boolean; showArchived: boolean }) {
  const [open, setOpen] = useState(openNew);
  const { name } = useOwnerName();
  const groups = (["bersama", "suami", "istri"] as const).map((o) => ({ owner: o, items: accounts.filter((a) => a.owner === o) })).filter((g) => g.items.length);
  const total = accounts.filter((a) => !a.isArchived).reduce((s, a) => s + a.balance, 0);
  return (
    <div className="space-y-3">
      <Card className="hero text-white">
        <div className="relative">
          <div className="text-[13px] text-white/80">Total saldo semua akun</div>
          <Money value={total} countUp className="text-display" />
        </div>
      </Card>
      <Button block onClick={() => setOpen(true)}>
        <Icon name="plus" /> Tambah akun
      </Button>
      {accounts.length === 0 && <EmptyState icon="wallet" title="Belum ada akun." />}
      {groups.map((g) => (
        <section key={g.owner}>
          <h2 className="mb-2 text-h2">{name(g.owner)}</h2>
          <Card className="divide-y divide-border/70 py-1">
            {g.items.map((a) => (
              <Link key={a.id} href={`/akun/${a.id}`} className="flex min-h-[64px] items-center gap-3 py-2">
                <CategoryIcon icon={a.icon} color={a.color} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold">
                    {a.name}
                    {a.isArchived && <span className="ml-1 text-caption text-muted">(arsip)</span>}
                  </div>
                  <div className="text-caption text-muted">
                    {ACCOUNT_TYPE_LABEL[a.type]}
                    {a.availableCredit != null && <> · sisa limit <Money value={a.availableCredit} short /></>}
                  </div>
                </div>
                <div className="text-right">
                  <Money value={a.balance} className={`text-[15px] font-semibold ${a.balance < 0 ? "text-expense" : ""}`} />
                  {a.outstanding != null && a.outstanding > 0 && <div className="text-caption text-muted">tagihan berjalan</div>}
                </div>
              </Link>
            ))}
          </Card>
        </section>
      ))}
      <Link href={showArchived ? "/akun" : "/akun?arsip=1"} className="block py-2 text-center text-[13px] font-semibold text-muted">
        {showArchived ? "Sembunyikan akun arsip" : "Tampilkan akun arsip"}
      </Link>
      <BottomSheet open={open} onOpenChange={setOpen} title="Akun baru">
        {open && <AccountForm onDone={() => setOpen(false)} />}
      </BottomSheet>
    </div>
  );
}
