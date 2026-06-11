import Link from "next/link";
import { buttonClassName } from "@/components/ui/Button";

// 404 global. Copy neutra de propósito: também é o que um visitante externo vê
// em URL pública malformada fora do shape /public/[token] — nada de informação
// interna nem de assumir usuário logado.
export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="font-mono text-[10px] uppercase tracking-wider text-mute mb-3">
          404
        </p>
        <h1 className="font-display text-2xl font-semibold mb-2">
          Página não encontrada
        </h1>
        <p className="text-sm text-mute mb-6">
          O endereço não existe ou não está mais disponível.
        </p>
        <Link href="/" className={buttonClassName()}>
          Ir para o início
        </Link>
      </div>
    </div>
  );
}
