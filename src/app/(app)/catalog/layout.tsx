import { requireAdmin } from "@/lib/auth/server";

export default async function CatalogLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  await requireAdmin("/operations");
  return <>{children}</>;
}
