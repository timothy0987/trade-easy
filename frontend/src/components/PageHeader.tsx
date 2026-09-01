import React from "react";

/**
 * Consistent page masthead across the app: an icon-led title, an optional
 * one-line description, and an optional actions slot on the right (status
 * pill, view switch, etc.). Keeps type scale and spacing identical everywhere.
 */
export function PageHeader({
  icon,
  title,
  description,
  actions,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-x-6 gap-y-3 flex-wrap">
      <div className="min-w-0">
        <h1 className="text-[1.6rem] sm:text-[1.75rem] leading-tight font-bold tracking-tight text-[var(--color-hz-navy)] flex items-center gap-2.5">
          {icon}
          <span>{title}</span>
        </h1>
        {description ? (
          <p className="text-[var(--color-ink-2)] text-sm mt-1.5 max-w-2xl">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
