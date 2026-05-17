export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      <header className="border-b border-line">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-display text-sm font-semibold tracking-tight">
            DRYOS · Delivery
          </div>
          <span className="font-mono text-[10px] text-mute uppercase tracking-wider">
            Painel do cliente
          </span>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {children}
      </main>
      <footer className="border-t border-line">
        <div className="max-w-5xl mx-auto px-6 py-4 font-mono text-[10px] text-mute uppercase tracking-wider">
          Powered by DRYOS Delivery
        </div>
      </footer>
    </div>
  );
}
