export default function CadastroLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <main className="min-h-screen bg-bg font-body text-ink-soft antialiased">
      <header className="border-b border-line bg-card/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="font-display text-lg text-ink font-semibold">
              DRYOS Studio
            </p>
            <p className="font-mono text-[10px] text-mute uppercase tracking-wide">
              Cadastro de cliente
            </p>
          </div>
        </div>
      </header>
      <div className="max-w-lg mx-auto px-4 py-6 pb-16">{children}</div>
      <footer className="py-6 text-center font-mono text-[10px] text-mute">
        Powered by DRYOS Studio
      </footer>
    </main>
  );
}
