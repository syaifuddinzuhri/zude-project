"use client";
import { useEffect } from "react";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";

/**
 * Keypad nominal custom: angka, 000, backspace, dan kalkulator sederhana + − × ÷.
 * `expr` adalah ekspresi mentah (mis. "25000+12500"); `evaluate` menghitung hasilnya.
 */
export function evaluate(expr: string): number {
  const tokens = expr.match(/(\d+|[+\-×÷])/g) ?? [];
  // Prioritas × ÷ lalu + −
  const nums: number[] = [];
  const ops: string[] = [];
  const apply = () => {
    const b = nums.pop() ?? 0;
    const a = nums.pop() ?? 0;
    const op = ops.pop();
    nums.push(op === "+" ? a + b : op === "-" ? a - b : op === "×" ? a * b : b === 0 ? a : a / b);
  };
  const prec = (o: string) => (o === "×" || o === "÷" ? 2 : 1);
  for (const t of tokens) {
    if (/^\d+$/.test(t)) nums.push(parseInt(t, 10));
    else {
      while (ops.length && prec(ops[ops.length - 1]) >= prec(t)) apply();
      ops.push(t);
    }
  }
  if (tokens.length && /[+\-×÷]/.test(tokens[tokens.length - 1])) ops.pop();
  while (ops.length) apply();
  return Math.max(0, Math.round(nums[0] ?? 0));
}

export function hasOperator(expr: string) {
  return /[+\-×÷]/.test(expr.replace(/^-/, ""));
}

const KEYS = ["1", "2", "3", "÷", "4", "5", "6", "×", "7", "8", "9", "-", "000", "0", "back", "+"];

export function Keypad({ value, onChange, onEnter, compact }: { value: string; onChange: (v: string) => void; onEnter?: () => void; compact?: boolean }) {
  const press = (k: string) => {
    if (k === "back") return onChange(value.slice(0, -1));
    if (k === "=") return onChange(String(evaluate(value)));
    const isOp = /[+\-×÷]/.test(k);
    if (isOp) {
      if (!value) return;
      if (/[+\-×÷]$/.test(value)) return onChange(value.slice(0, -1) + k);
      return onChange(value + k);
    }
    const lastNum = value.split(/[+\-×÷]/).pop() ?? "";
    if (lastNum === "0" || (lastNum === "" && k === "000")) {
      if (k === "000") return;
      return onChange(value.slice(0, -1 * lastNum.length || undefined) + k);
    }
    if ((lastNum + k).length > 13) return;
    onChange(value + k);
  };

  // Keyboard fisik (desktop): angka, operator, Backspace, Enter
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "+" || e.key === "-") press(e.key);
      else if (e.key === "*" || e.key === "x") press("×");
      else if (e.key === "/") press("÷");
      else if (e.key === "Backspace") press("back");
      else if (e.key === "Enter") {
        e.preventDefault();
        if (hasOperator(value)) press("=");
        else onEnter?.();
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  return (
    <div className="grid grid-cols-4 gap-2" role="group" aria-label="Keypad nominal">
      {KEYS.map((k) => {
        const op = /[+\-×÷]/.test(k);
        const label = k === "-" ? "−" : k;
        return (
          <button
            type="button"
            key={k}
            onClick={() => (op && hasOperator(value) && !/[+\-×÷]$/.test(value) ? onChange(String(evaluate(value)) + k) : press(k))}
            className={cn(
              "pressable flex items-center justify-center rounded-btn text-[20px] font-semibold",
              compact ? "h-11" : "h-[52px]",
              op ? "bg-primary-soft text-primary" : "bg-surface text-text shadow-card",
            )}
            aria-label={k === "back" ? "Hapus" : label}
          >
            {k === "back" ? <Icon name="delete" size={22} /> : label}
          </button>
        );
      })}
      {hasOperator(value) && (
        <button type="button" onClick={() => press("=")} className="pressable col-span-4 h-11 rounded-btn bg-accent/15 text-[16px] font-bold text-accent">
          = Hitung
        </button>
      )}
    </div>
  );
}
