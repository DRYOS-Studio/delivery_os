import { LoginForm } from "@/components/auth/LoginForm";

type SearchParams = Promise<{ redirectTo?: string; error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { redirectTo, error } = await searchParams;
  const safeRedirectTo =
    typeof redirectTo === "string" && redirectTo.startsWith("/")
      ? redirectTo
      : "/";

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg p-7">
      <div className="w-full max-w-sm bg-card border border-line rounded shadow-sm p-7">
        <h1 className="font-display text-2xl text-ink">DRYOS Delivery</h1>
        <p className="font-mono text-xs text-mute mt-2 mb-6">
          — entre com seu e-mail
        </p>
        <LoginForm redirectTo={safeRedirectTo} initialError={error} />
      </div>
    </main>
  );
}
