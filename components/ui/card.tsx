import { cn } from "@/lib/utils";

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-card border border-border/60 bg-surface p-4 shadow-card", className)} {...rest}>
      {children}
    </div>
  );
}

export function GlassCard({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("glass rounded-card p-4 shadow-glass", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, action, className }: { title: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-2 flex items-center justify-between", className)}>
      <h2 className="text-h2">{title}</h2>
      {action}
    </div>
  );
}
