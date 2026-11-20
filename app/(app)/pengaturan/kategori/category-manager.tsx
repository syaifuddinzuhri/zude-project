"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveCategoryAction } from "@/lib/actions/categories";
import { NATURE_LABEL } from "@/lib/utils";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Switch } from "@/components/ui/field";
import { CategoryIcon, ICONS, Icon } from "@/components/ui/icon";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface Cat { id: number; name: string; kind: "income" | "expense"; parentId: number | null; nature: string | null; icon: string; color: string; isArchived: boolean; system: boolean }
const COLORS = ["#14B8A6", "#6366F1", "#F59E0B", "#EC4899", "#0EA5E9", "#84CC16", "#F97316", "#A855F7", "#94A3B8"];
const PICK_ICONS = Object.keys(ICONS).filter((k) => !["chevron-left", "chevron-right", "chevron-down", "x", "check", "plus", "menu", "eye", "eye-off", "log-out", "delete"].includes(k));

export function CategoryManager({ cats }: { cats: Cat[] }) {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [edit, setEdit] = useState<Partial<Cat> | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const list = cats.filter((c) => c.kind === kind && (showArchived || !c.isArchived));
  const parents = list.filter((c) => c.parentId === null);

  const save = () =>
    start(async () => {
      const r = await saveCategoryAction(edit!.id ?? null, { ...edit, kind });
      if (!r.ok) return toast.error(r.error);
      toast.success("Kategori disimpan");
      setEdit(null);
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <Segmented value={kind} onChange={setKind} options={[{ value: "expense", label: "Pengeluaran" }, { value: "income", label: "Pemasukan" }]} />
      <Button block onClick={() => setEdit({ name: "", parentId: null, nature: "needs", icon: "circle", color: COLORS[0] })}><Icon name="plus" /> Kategori baru</Button>
      {parents.map((p) => (
        <Card key={p.id} className={cn("py-2", p.isArchived && "opacity-60")}>
          <button className="flex min-h-[52px] w-full items-center gap-3 text-left" onClick={() => setEdit(p)}>
            <CategoryIcon icon={p.icon} color={p.color} />
            <div className="flex-1">
              <div className="text-[15px] font-semibold">{p.name}{p.isArchived && " (arsip)"}</div>
              {p.nature && <div className="text-caption text-muted">{NATURE_LABEL[p.nature]}</div>}
            </div>
            <Icon name="pencil" size={16} className="text-muted" />
          </button>
          <div className="flex flex-wrap gap-2 pb-1 pl-[52px]">
            {list.filter((c) => c.parentId === p.id).map((c) => (
              <button key={c.id} onClick={() => setEdit(c)} className={cn("h-9 rounded-full bg-bg px-3 text-[13px] font-medium", c.isArchived && "line-through opacity-60")}>{c.name}</button>
            ))}
            <button onClick={() => setEdit({ name: "", parentId: p.id, icon: p.icon, color: p.color })} className="h-9 rounded-full border border-dashed border-border px-3 text-[13px] font-semibold text-primary">+ Sub</button>
          </div>
        </Card>
      ))}
      <button onClick={() => setShowArchived((s) => !s)} className="block w-full py-2 text-center text-[13px] font-semibold text-muted">{showArchived ? "Sembunyikan arsip" : "Tampilkan arsip"}</button>

      <BottomSheet open={!!edit} onOpenChange={(v) => !v && setEdit(null)} title={edit?.id ? "Ubah kategori" : "Kategori baru"} footer={<Button block loading={pending} onClick={save}>Simpan</Button>}>
        {edit && (
          <>
            <Field label="Nama"><Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Induk">
              <Select value={edit.parentId ?? ""} onChange={(e) => setEdit({ ...edit, parentId: Number(e.target.value) || null })} disabled={Boolean(edit.id && cats.some((c) => c.parentId === edit.id))}>
                <option value="">— (kategori utama)</option>
                {cats.filter((c) => c.kind === kind && c.parentId === null && c.id !== edit.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            {kind === "expense" && !edit.parentId && (
              <Field label="Sifat (untuk rasio 50/30/20)">
                <Select value={edit.nature ?? "needs"} onChange={(e) => setEdit({ ...edit, nature: e.target.value })}>
                  {Object.entries(NATURE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Ikon">
              <div className="grid max-h-40 grid-cols-8 gap-1.5 overflow-y-auto">
                {PICK_ICONS.map((i) => (
                  <button key={i} onClick={() => setEdit({ ...edit, icon: i })} className={cn("flex h-10 items-center justify-center rounded-xl", edit.icon === i ? "bg-primary text-on-primary" : "bg-bg")} aria-label={i}><Icon name={i} size={18} /></button>
                ))}
              </div>
            </Field>
            <Field label="Warna">
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => <button key={c} onClick={() => setEdit({ ...edit, color: c })} className={cn("h-9 w-9 rounded-full", edit.color === c && "ring-2 ring-text ring-offset-2 ring-offset-[var(--surface)]")} style={{ background: c }} aria-label={c} />)}
              </div>
            </Field>
            {edit.id && <Switch checked={Boolean(edit.isArchived)} onChange={(v) => setEdit({ ...edit, isArchived: v })} label="Arsipkan" description={edit.system ? "Kategori sistem — sebaiknya tidak diarsipkan" : "Tidak muncul di pilihan, riwayat tetap ada"} />}
          </>
        )}
      </BottomSheet>
    </div>
  );
}
