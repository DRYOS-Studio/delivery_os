export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {children}
      </main>
      <footer className="border-t border-line">
        <div className="max-w-5xl mx-auto px-6 py-4 font-mono text-[10px] text-mute uppercase tracking-wider">
          Powered by DRYOS Studio
        </div>
      </footer>
    </div>
  );
}
