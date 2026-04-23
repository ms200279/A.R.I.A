type Props = {
  title: string;
  description?: string;
  children?: React.ReactNode;
};

export default function DocumentEmptyState({ title, description, children }: Props) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--bg-overlay)] px-4 py-5">
      <p className="text-sm font-medium text-[var(--text-secondary)]">{title}</p>
      {description ? (
        <p className="mt-1 text-sm text-[var(--text-tertiary)] leading-relaxed">{description}</p>
      ) : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
