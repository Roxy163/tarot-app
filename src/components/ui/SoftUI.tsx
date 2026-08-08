import React from 'react';

interface SoftSectionEyebrowProps {
  children: React.ReactNode;
  className?: string;
}

interface QuietEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

interface SoftSkeletonProps {
  rows?: number;
  className?: string;
}

export const softPanelClassName = 'rounded-[1.45rem] border border-forest-accent/7 bg-white/28 shadow-[0_14px_42px_-38px_rgba(62,58,54,0.45)] backdrop-blur-sm';

export const SoftSectionEyebrow = ({ children, className = '' }: SoftSectionEyebrowProps) => (
  <p className={`text-[10px] font-medium uppercase tracking-[0.2em] text-forest-accent/82 ${className}`}>
    {children}
  </p>
);

export const QuietEmptyState = ({
  icon,
  title,
  description,
  action,
  className = '',
}: QuietEmptyStateProps) => (
  <div
    className={`relative overflow-hidden rounded-[1.05rem] border border-dashed border-forest-accent/12 bg-white/22 px-3.5 py-3 text-center text-forest-muted sm:rounded-[1.35rem] sm:px-5 sm:py-6 ${className}`}
  >
    <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-forest-accent/18 to-transparent" />
    {icon && (
      <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-2xl bg-forest-accent/7 text-forest-accent/46 sm:h-10 sm:w-10">
        {icon}
      </div>
    )}
    <p className={`${icon ? 'mt-1.5 sm:mt-2.5' : ''} font-serif text-sm font-semibold text-forest-ink sm:text-base`}>{title}</p>
    {description && (
      <p className="mx-auto mt-1 max-w-xs text-[11px] leading-relaxed text-forest-muted/82 sm:mt-1.5 sm:text-xs">
        {description}
      </p>
    )}
    {action && <div className="mt-3 sm:mt-4">{action}</div>}
  </div>
);

export const SoftSkeleton = ({ rows = 2, className = '' }: SoftSkeletonProps) => (
  <div className={`space-y-3 rounded-[1.45rem] border border-forest-accent/7 bg-white/22 p-4 ${className}`} role="status" aria-live="polite">
    <div className="h-3 w-24 animate-pulse rounded-full bg-forest-accent/9" />
    <div className="grid gap-3 md:grid-cols-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="space-y-3 rounded-2xl border border-forest-accent/6 bg-white/22 p-3">
          <div className="h-4 w-2/5 animate-pulse rounded-full bg-forest-accent/8" />
          <div className="h-3 w-4/5 animate-pulse rounded-full bg-forest-accent/6" />
          <div className="h-3 w-3/5 animate-pulse rounded-full bg-forest-accent/6" />
        </div>
      ))}
    </div>
  </div>
);
