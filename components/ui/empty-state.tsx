import type { ReactNode } from "react";
import { cn } from "./cn";

/** What a list shows when it has nothing in it yet. */
export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center px-4 py-8 text-center", className)}>
      {icon && <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground [&_svg]:size-5">{icon}</div>}
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
