export function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-ink-100 py-10 first:border-t-0 first:pt-0">
      <h2 className="mb-1 font-serif text-2xl text-ink-950">{title}</h2>
      {subtitle && <p className="mb-6 text-sm text-ink-500">{subtitle}</p>}
      {!subtitle && <div className="mb-6" />}
      {children}
    </section>
  );
}
