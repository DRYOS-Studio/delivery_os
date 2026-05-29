import { MobileShell } from "@/components/layout/MobileShell";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MobileShell sidebar={<Sidebar />}>{children}</MobileShell>;
}
