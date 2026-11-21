"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAppData } from "@/components/app-data";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, OptionalDateInput, Select } from "@/components/ui/field";
import { Chip } from "@/components/ui/segmented";
import { Icon } from "@/components/ui/icon";
import { TX_TYPE_LABEL } from "@/lib/utils";

const KEYS = ["dari", "sampai", "jenis", "akun", "kategori", "pemilik", "tag", "min", "maks"] as const;

export function TxFilterBar() {
  const params = useSearchParams();
  const router = useRouter();
  const d = useAppData();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") === q) return;
      const p = new URLSearchParams(params.toString());
      if (q) p.set("q", q);
      else p.delete("q");
      p.delete("n");
      router.replace(`/transaksi?${p.toString()}`, { scroll: false });
    }, 350);
    return () => clearTimeout(t);
  }, [q, params, router]);

  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    p.delete("n");
    router.replace(`/transaksi?${p.toString()}`, { scroll: false });
  };

  const active = KEYS.filter((k) => params.get(k)).length;
  const jenis = params.get("jenis");
  const pemilik = params.get("pemilik");

  return (
    <div className="mb-3">
      <div className="relative mb-2">
        <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari catatan atau kategori" className="pl-11" type="search" aria-label="Cari transaksi" />
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <Chip active={active > 0} onClick={() => { setDraft(Object.fromEntries(KEYS.map((k) => [k, params.get(k) ?? ""]))); setOpen(true); }}>
          <Icon name="sliders" size={14} /> Filter{active ? ` (${active})` : ""}
        </Chip>
        {(["expense", "income", "transfer"] as const).map((t) => (
          <Chip key={t} active={jenis === t} onClick={() => set("jenis", jenis === t ? null : t)}>
            {TX_TYPE_LABEL[t]}
          </Chip>
        ))}
        {(["suami", "istri", "bersama"] as const).map((o) => (
          <Chip key={o} active={pemilik === o} onClick={() => set("pemilik", pemilik === o ? null : o)}>
            {d.names[o]}
          </Chip>
        ))}
        {active > 0 && (
          <Chip onClick={() => router.replace("/transaksi")}>
            <Icon name="x" size={14} /> Reset
          </Chip>
        )}
      </div>

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Filter transaksi"
        footer={
          <Button
            block
            onClick={() => {
              const p = new URLSearchParams();
              if (q) p.set("q", q);
              for (const [k, v] of Object.entries(draft)) if (v) p.set(k, v);
              router.replace(`/transaksi?${p.toString()}`, { scroll: false });
              setOpen(false);
            }}
          >
            Terapkan
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-2">
          <Field label="Dari tanggal">
            <OptionalDateInput value={draft.dari} onChange={(x) => setDraft({ ...draft, dari: x })} />
          </Field>
          <Field label="Sampai tanggal">
            <OptionalDateInput value={draft.sampai} onChange={(x) => setDraft({ ...draft, sampai: x })} />
          </Field>
        </div>
        <Field label="Jenis">
          <Select value={draft.jenis ?? ""} onChange={(e) => setDraft({ ...draft, jenis: e.target.value })}>
            <option value="">Semua</option>
            {Object.entries(TX_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
        <Field label="Akun">
          <Select value={draft.akun ?? ""} onChange={(e) => setDraft({ ...draft, akun: e.target.value })}>
            <option value="">Semua akun</option>
            {d.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Kategori">
          <Select value={draft.kategori ?? ""} onChange={(e) => setDraft({ ...draft, kategori: e.target.value })}>
            <option value="">Semua kategori</option>
            {d.categories.filter((c) => c.parentId === null).map((p) => (
              <optgroup key={p.id} label={`${p.kind === "income" ? "Masuk" : "Keluar"} · ${p.name}`}>
                <option value={p.id}>{p.name} (semua)</option>
                {d.categories.filter((c) => c.parentId === p.id).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field label="Pemilik akun">
          <Select value={draft.pemilik ?? ""} onChange={(e) => setDraft({ ...draft, pemilik: e.target.value })}>
            <option value="">Semua</option>
            <option value="bersama">Bersama</option>
            <option value="suami">{d.names.suami}</option>
            <option value="istri">{d.names.istri}</option>
          </Select>
        </Field>
        <Field label="Tag">
          <Input value={draft.tag ?? ""} onChange={(e) => setDraft({ ...draft, tag: e.target.value })} placeholder="mis. lebaran" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Nominal min">
            <Input inputMode="numeric" value={draft.min ?? ""} onChange={(e) => setDraft({ ...draft, min: e.target.value.replace(/\D/g, "") })} />
          </Field>
          <Field label="Nominal maks">
            <Input inputMode="numeric" value={draft.maks ?? ""} onChange={(e) => setDraft({ ...draft, maks: e.target.value.replace(/\D/g, "") })} />
          </Field>
        </div>
      </BottomSheet>
    </div>
  );
}
