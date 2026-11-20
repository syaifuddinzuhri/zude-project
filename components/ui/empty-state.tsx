import Link from "next/link";
import { Icon } from "./icon";

export function EmptyState({ icon, title, action, href, onAction }: { icon: string; title: string; action?: string; href?: string; onAction?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-10 text-center shadow-card">
      <div className="relative">
        <div className="absolute inset-0 -z-0 scale-150 rounded-full bg-primary-soft blur-xl" />
        <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon name={icon} size={30} />
        </span>
      </div>
      <p className="text-body text-muted">{title}</p>
      {action &&
        (href ? (
          <Link href={href} className="pressable inline-flex h-11 items-center rounded-btn bg-primary px-4 font-semibold text-on-primary">
            {action}
          </Link>
        ) : (
          <button onClick={onAction} className="pressable inline-flex h-11 items-center rounded-btn bg-primary px-4 font-semibold text-on-primary">
            {action}
          </button>
        ))}
    </div>
  );
}
