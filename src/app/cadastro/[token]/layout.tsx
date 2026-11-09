import Image from "next/image";

export default function CadastroLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <main className="min-h-dvh bg-bg font-body text-ink-soft antialiased overflow-x-hidden">
      <header className="border-b border-line bg-card/90 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-lg mx-auto w-full px-4 py-3 flex flex-col items-center gap-1">
          <Image
            src="/brand/dryos-logo.png"
            alt="DRYOS"
            width={140}
            height={29}
            className="h-7 w-auto max-w-[min(100%,160px)]"
            priority
          />
          <p className="font-mono text-[10px] text-mute uppercase tracking-wide">
            Cadastro de cliente
          </p>
        </div>
      </header>
      <div className="max-w-lg mx-auto w-full px-4 py-4 pb-28">{children}</div>
      <footer className="py-4 text-center font-mono text-[10px] text-mute px-4">
        Powered by DRYOS Studio
      </footer>
    </main>
  );
}
