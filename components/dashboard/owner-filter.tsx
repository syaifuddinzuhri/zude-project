"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Segmented } from "../ui/segmented";
import { useOwnerName } from "../app-data";

export function OwnerFilterBar({ value }: { value: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { names } = useOwnerName();
  return (
    <Segmented
      value={value}
      onChange={(v) => {
        const p = new URLSearchParams(params.toString());
        if (v === "semua") p.delete("f");
        else p.set("f", v);
        router.push(`/?${p.toString()}`, { scroll: false });
      }}
      options={[
        { value: "semua", label: "Semua" },
        { value: "bersama", label: "Bersama" },
        { value: "suami", label: names.suami },
        { value: "istri", label: names.istri },
      ]}
    />
  );
}
