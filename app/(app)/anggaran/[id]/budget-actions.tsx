"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { removeBudgetAction } from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function BudgetActions({ id }: { id: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="mt-3 text-expense"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await removeBudgetAction(id);
          if (!r.ok) return toast.error(r.error);
          toast.success("Anggaran dihapus");
          router.push("/anggaran");
          router.refresh();
        })
      }
    >
      Hapus anggaran ini
    </Button>
  );
}
