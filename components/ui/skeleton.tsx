import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-card bg-surface p-4 shadow-card">
      <Skeleton className="mb-3 h-5 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="mb-2 h-4 w-full last:mb-0" />
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-3 px-4 pt-20">
      <Skeleton className="h-40 w-full rounded-card" />
      <CardSkeleton />
      <CardSkeleton lines={4} />
    </div>
  );
}
