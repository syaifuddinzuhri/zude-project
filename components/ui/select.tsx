"use client";
import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState } from "react";
import { BottomSheet } from "./bottom-sheet";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";

interface Opt {
  value: string;
  label: string;
  group: string | null;
  disabled?: boolean;
}

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

/** Baca <option>/<optgroup> anak menjadi daftar pilihan (API sama dengan <select> biasa). */
function parseOptions(children: React.ReactNode, group: string | null = null): Opt[] {
  const out: Opt[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<{ value?: string | number; children?: React.ReactNode; label?: string; disabled?: boolean }>(child)) return;
    if (child.type === "optgroup") out.push(...parseOptions(child.props.children, child.props.label ?? null));
    else if (child.type === "option") {
      const label = textOf(child.props.children).replace(/\s+/g, " ").trim();
      out.push({ value: String(child.props.value ?? label), label, group, disabled: child.props.disabled });
    }
  });
  return out;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export interface SelectProps {
  value?: string | number | null;
  onChange?: (e: { target: { value: string } }) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  /** Judul lembar pilihan (default: aria-label / label Field). */
  title?: string;
  /** Kotak cari tampil bila pilihan > N (default 6). */
  searchThreshold?: number;
}

/**
 * Dropdown dengan pencarian: tombol bergaya input → bottom sheet berisi kotak cari & daftar.
 * Pengganti <select> bawaan (gaya native berbeda-beda & abu-abu di dark mode).
 */
export function Select({ value, onChange, children, className, disabled, id, title, searchThreshold = 6, ...rest }: SelectProps) {
  const options = useMemo(() => parseOptions(children), [children]);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const current = options.find((o) => o.value === String(value ?? ""));
  const placeholder = options.find((o) => o.value === "")?.label ?? "Pilih";
  const showSearch = options.length > searchThreshold;
  const label = title ?? rest["aria-label"] ?? "Pilih";

  const filtered = useMemo(() => {
    const t = norm(q.trim());
    if (!t) return options;
    return options.filter((o) => norm(o.label).includes(t) || (o.group && norm(o.group).includes(t)));
  }, [q, options]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    const idx = Math.max(0, options.findIndex((o) => o.value === String(value ?? "")));
    setActive(idx);
    // Fokus otomatis ke kotak cari hanya di perangkat dengan mouse (hindari keyboard HP muncul tiba-tiba)
    const t = setTimeout(() => {
      if (showSearch && window.matchMedia("(pointer: fine)").matches) searchRef.current?.focus();
      listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "center" });
    }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => setActive(0), [q]);

  const pick = (o: Opt) => {
    if (o.disabled) return;
    onChange?.({ target: { value: o.value } });
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) pick(filtered[active]);
    }
  };

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  let lastGroup: string | null | undefined;

  return (
    <>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen(true)}
        role="combobox"
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-expanded={open ? "true" : "false"}
        aria-label={rest["aria-label"]}
        className={cn(
          "flex h-12 w-full items-center gap-2 rounded-btn border border-border bg-surface pl-3.5 pr-3 text-left text-input text-text outline-none transition-shadow focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50",
          className,
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", (!current || current.value === "") && "text-muted")}>{current?.label ?? placeholder}</span>
        <Icon name="chevron-down" size={18} className="shrink-0 text-muted" />
      </button>

      <BottomSheet open={open} onOpenChange={setOpen} title={label}>
        {showSearch && (
          <div className="sticky top-0 z-10 -mx-5 bg-transparent px-5 pb-2">
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                ref={searchRef}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKey}
                placeholder="Cari…"
                aria-label={`Cari ${label}`}
                className="h-12 w-full rounded-btn border border-border bg-surface pl-11 pr-3.5 text-input text-text outline-none placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
        )}
        <div ref={listRef} id={listId} role="listbox" aria-label={label} tabIndex={showSearch ? -1 : 0} onKeyDown={showSearch ? undefined : onKey} className="pb-2 outline-none">
          {filtered.length === 0 && <p className="py-6 text-center text-caption text-muted">Tidak ada yang cocok dengan &quot;{q}&quot;</p>}
          {filtered.map((o, i) => {
            const header = o.group !== lastGroup && o.group ? o.group : null;
            lastGroup = o.group;
            const selected = o.value === String(value ?? "");
            return (
              <div key={`${o.group}:${o.value}:${i}`}>
                {header && <div className="px-1 pb-1 pt-3 text-caption font-semibold text-muted">{header}</div>}
                <button
                  type="button"
                  role="option"
                  data-idx={i}
                  aria-selected={selected}
                  disabled={o.disabled}
                  onClick={() => pick(o)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex min-h-[48px] w-full items-center gap-3 rounded-btn px-3 text-left text-[15px] disabled:opacity-40",
                    selected ? "bg-primary-soft font-semibold text-primary" : i === active ? "bg-border/50" : "",
                    o.value === "" && "text-muted",
                  )}
                >
                  <span className="min-w-0 flex-1">{o.label}</span>
                  {selected && <Icon name="check" size={18} />}
                </button>
              </div>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}
