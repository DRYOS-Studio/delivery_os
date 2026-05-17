"use client";

import { ShieldCheck, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setUserRoleAction } from "@/lib/actions/profiles";
import type { Role } from "@/lib/auth/server";

export function SetUserRoleButton({
  targetUserId,
  targetEmail,
  currentRole,
  isSelf,
}: {
  targetUserId: string;
  targetEmail: string | null;
  currentRole: Role;
  isSelf: boolean;
}): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const target = targetEmail ?? targetUserId.slice(0, 8);
  const isAdmin = currentRole === "admin";
  const newRole: Role = isAdmin ? "member" : "admin";

  async function handleClick() {
    if (isSelf) return;
    const verb = isAdmin ? "Rebaixar" : "Promover";
    const newLabel = isAdmin ? "member" : "admin";
    if (!window.confirm(`${verb} ${target} a ${newLabel}?`)) return;
    setBusy(true);
    const result = await setUserRoleAction(targetUserId, newRole);
    if (result.ok) {
      router.refresh();
    } else {
      window.alert(`Erro: ${result.error}`);
      setBusy(false);
    }
  }

  if (isSelf) {
    return (
      <span
        className="font-mono text-[10px] text-mute-soft italic"
        title="Você não pode mudar seu próprio papel"
      >
        Você
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-mono rounded disabled:opacity-50 transition-colors ${
        isAdmin
          ? "text-warning hover:bg-warning-bg"
          : "text-sage-deep hover:bg-sage-bg"
      }`}
    >
      {isAdmin ? (
        <>
          <UserMinus className="w-3 h-3" strokeWidth={1.75} />
          {busy ? "Rebaixando..." : "Rebaixar"}
        </>
      ) : (
        <>
          <ShieldCheck className="w-3 h-3" strokeWidth={1.75} />
          {busy ? "Promovendo..." : "Promover"}
        </>
      )}
    </button>
  );
}
