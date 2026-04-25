export default function ComparisonDetailLoading() {
  return (
    <div className="h-full overflow-y-auto">
      <section className="mx-auto max-w-3xl space-y-8 px-6 py-10">
        <div className="flex gap-4">
          <div className="h-4 w-28 animate-pulse rounded bg-[var(--bg-overlay)]" />
          <div className="h-4 w-32 animate-pulse rounded bg-[var(--bg-overlay)]" />
        </div>
        <div className="space-y-2 border-b border-[var(--border-subtle)] pb-6">
          <div className="h-4 w-full max-w-md animate-pulse rounded bg-[var(--bg-overlay)]" />
          <div className="h-3 w-48 animate-pulse rounded bg-[var(--bg-overlay)]" />
        </div>
        <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-[var(--bg-overlay)]" />
        <div className="h-64 animate-pulse rounded-[var(--radius-lg)] bg-[var(--bg-overlay)]" />
      </section>
    </div>
  );
}
