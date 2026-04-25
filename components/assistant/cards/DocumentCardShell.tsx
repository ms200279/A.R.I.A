"use client";

type Variant = "comparison" | "analysis";

type Props = {
  variant: Variant;
  eyebrow: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

export default function DocumentCardShell({ variant, eyebrow, children, actions }: Props) {
  const skin =
    variant === "comparison"
      ? "border-amber-500/30 bg-amber-500/[0.06]"
      : "border-sky-500/30 bg-sky-500/[0.06]";

  return (
    <div className={`rounded-xl border ${skin}`}>
      <div className="px-3 py-2.5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
          {eyebrow}
        </p>
        <div className="mt-1.5 space-y-1">{children}</div>
        {actions ? <div className="mt-2 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
