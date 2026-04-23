export default function DocumentDetailLoading() {
  return (
    <div className="h-full overflow-y-auto">
      <section className="mx-auto max-w-3xl space-y-8 px-6 py-10">
        <div className="h-4 w-28 animate-pulse rounded bg-[var(--bg-overlay)]" />
        <div className="space-y-3">
          <div className="h-8 w-2/3 animate-pulse rounded bg-[var(--bg-overlay)]" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--bg-overlay)]" />
        </div>
        <div className="h-48 animate-pulse rounded-[var(--radius-lg)] bg-[var(--bg-overlay)]" />
        <div className="h-24 animate-pulse rounded-[var(--radius-lg)] bg-[var(--bg-overlay)]" />
        <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-[var(--bg-overlay)]" />
        <div className="h-56 animate-pulse rounded-[var(--radius-lg)] bg-[var(--bg-overlay)]" />
      </section>
    </div>
  );
}
