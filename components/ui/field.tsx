"use client";
import { cloneElement, forwardRef, isValidElement, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function Label({ children, htmlFor, className }: { children: React.ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 block text-caption text-muted", className)}>
      {children}
    </label>
  );
}

const base =
  "w-full min-w-0 rounded-btn border border-border bg-surface px-3.5 text-input text-text outline-none transition-shadow placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/40 focus:shadow-[0_0_0_4px_rgba(15,118,110,0.12)]";

/**
 * `autoFocus` hanya berlaku di perangkat dengan mouse/trackpad. Di HP/tablet (layar sentuh)
 * keyboard tidak dibuka otomatis — baru muncul saat isian diketuk.
 */
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, autoFocus, ...rest }, ref) {
  const inner = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!autoFocus) return;
    if (typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches) {
      const t = setTimeout(() => inner.current?.focus({ preventScroll: true }), 50);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);
  return (
    <input
      ref={(el) => {
        inner.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      className={cn(base, "h-12", className)}
      {...rest}
    />
  );
});

export { Select } from "./select";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(base, "min-h-[88px] py-3", className)} {...rest} />;
});

export function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  const auto = useId();
  // Tautkan label ke kontrol tunggal (input/select/MoneyInput) agar terbaca pembaca layar
  const single = isValidElement<{ id?: string; "aria-label"?: string }>(children) ? children : null;
  const id = single ? single.props.id ?? auto : undefined;
  return (
    <div className={cn("mb-3", className)}>
      <Label htmlFor={id}>{label}</Label>
      {single ? cloneElement(single, { id, "aria-label": single.props["aria-label"] ?? label }) : children}
      {hint && <p className="mt-1 text-caption text-muted">{hint}</p>}
    </div>
  );
}

export function Switch({ checked, onChange, label, description, name }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; name?: string }) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 py-1">
      <span>
        <span className="block text-[15px] font-medium">{label}</span>
        {description && <span className="block text-caption text-muted">{description}</span>}
      </span>
      <input type="checkbox" name={name} className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="relative h-7 w-12 shrink-0 rounded-full bg-border transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-primary" />
    </label>
  );
}

/** Input nominal dengan pemisah ribuan (untuk form selain keypad, mis. pengaturan). */
export function MoneyInput({ value, onChange, placeholder, id, autoFocus }: { value: number; onChange: (v: number) => void; placeholder?: string; id?: string; autoFocus?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-input text-muted">Rp</span>
      <Input
        id={id}
        autoFocus={autoFocus}
        inputMode="numeric"
        className="money pl-11"
        placeholder={placeholder ?? "0"}
        value={value ? value.toLocaleString("id-ID") : ""}
        onChange={(e) => onChange(parseInt(e.target.value.replace(/\D/g, "") || "0", 10))}
      />
    </div>
  );
}

/**
 * Input bilangan bulat (tanggal, bulan, persen). Teks boleh dikosongkan selama diketik
 * (mis. hapus "1" lalu ketik "25"); batas min dipasang saat isian ditinggalkan (blur).
 * Nilai di atas max langsung dipotong ke max.
 */
export function IntInput({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "min" | "max"> & {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const [text, setText] = useState(String(value));
  const emitted = useRef(value);
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    setText(String(value));
  }, [value]);
  const emit = (n: number) => {
    emitted.current = n;
    onChange(n);
  };
  return (
    <Input
      {...rest}
      inputMode="numeric"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
        if (t === "") return setText("");
        const n = Math.min(max, Number(t));
        setText(String(n));
        if (n >= min) emit(n);
      }}
      onBlur={(e) => {
        const n = text === "" ? Math.max(min, Math.min(max, emitted.current)) : Math.max(min, Math.min(max, Number(text)));
        setText(String(n));
        if (n !== emitted.current) emit(n);
        rest.onBlur?.(e);
      }}
    />
  );
}

/** Teks desimal → angka. Menerima koma atau titik sebagai pemisah desimal ("19,8" / "19.8"). */
export function parseDecimal(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "" || t === ".") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const fmtDecimal = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

/**
 * Input angka desimal (bunga %, berat gram). Teks disimpan apa adanya selama diketik,
 * jadi "19," tidak langsung hilang komanya; nilai angka dikirim lewat onChange.
 */
export function DecimalInput({
  value,
  onChange,
  maxDecimals = 2,
  suffix,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  maxDecimals?: number;
  suffix?: string;
}) {
  const [text, setText] = useState(fmtDecimal(value));
  const emitted = useRef<number | null>(value ?? null);
  // Sinkron hanya bila nilai diubah dari luar (mis. form di-reset), bukan saat sedang diketik
  useEffect(() => {
    if ((value ?? null) === emitted.current) return;
    emitted.current = value ?? null;
    setText(fmtDecimal(value));
  }, [value]);
  const input = (
    <Input
      {...rest}
      inputMode="decimal"
      autoComplete="off"
      value={text}
      className={cn(suffix && "pr-12", rest.className)}
      onChange={(e) => {
        // Hanya angka + satu pemisah (koma/titik), dibatasi jumlah desimal
        let t = e.target.value.replace(/[^\d.,]/g, "");
        const sep = t.search(/[.,]/);
        if (sep >= 0) {
          const head = t.slice(0, sep);
          const tail = t.slice(sep + 1).replace(/[.,]/g, "").slice(0, maxDecimals);
          t = `${head},${tail}`;
        }
        setText(t);
        emitted.current = parseDecimal(t);
        onChange(emitted.current);
      }}
    />
  );
  if (!suffix) return input;
  return (
    <div className="relative">
      {input}
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-input text-muted">{suffix}</span>
    </div>
  );
}
