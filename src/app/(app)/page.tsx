import { getUser } from "@/lib/auth/server";
import { signOutAction } from "@/lib/actions/auth";

export default async function Page() {
  const user = await getUser();

  return (
    <main className="p-7">
      <h1 className="font-display text-2xl text-ink">DRYOS Delivery</h1>
      <p className="font-mono text-xs text-mute mt-2">— semana 01 · setup</p>
      <p className="font-mono text-xs text-mute mt-4">
        logado: {user?.email ?? "anon"}
      </p>
      <form action={signOutAction} className="mt-4">
        <button
          type="submit"
          className="text-xs font-mono text-critical hover:underline"
        >
          sair
        </button>
      </form>
    </main>
  );
}
