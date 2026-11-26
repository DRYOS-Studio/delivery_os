"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { retryMeetingGoogleCalendarSyncAction } from "@/lib/actions/meeting-google-calendar";
import type { Database } from "@/lib/db/types";

type SyncStatus = Database["public"]["Enums"]["google_calendar_sync_status"];

type Props = {
  meetingId: string;
  syncStatus: SyncStatus | null;
  syncError: string | null;
  htmlLink: string | null;
  meetLink: string | null;
  sendInvitesDefault: boolean;
};

function statusLabel(status: SyncStatus | null): string {
  switch (status) {
    case "synced":
      return "Sincronizado";
    case "pending":
      return "Sync pendente";
    case "failed":
      return "Falha na sync";
    case "skipped":
      return "Sem integração";
    default:
      return "Aguardando sync";
  }
}

function statusVariant(
  status: SyncStatus | null,
): "ok" | "warning" | "critical" | "neutral" {
  switch (status) {
    case "synced":
      return "ok";
    case "pending":
      return "warning";
    case "failed":
      return "critical";
    case "skipped":
      return "neutral";
    default:
      return "neutral";
  }
}

export function MeetingGoogleCalendarPanel({
  meetingId,
  syncStatus,
  syncError,
  htmlLink,
  meetLink,
  sendInvitesDefault,
}: Props): React.JSX.Element | null {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const showRetry =
    syncStatus === "pending" || syncStatus === "failed" || syncStatus === null;

  if (
    !htmlLink &&
    !meetLink &&
    !syncStatus &&
    !showRetry
  ) {
    return null;
  }

  function handleRetry(): void {
    setError(null);
    startTransition(async () => {
      const res = await retryMeetingGoogleCalendarSyncAction(meetingId, {
        sendInvites: sendInvitesDefault,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="border border-line rounded px-3 py-3 space-y-2 bg-bg">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Google Calendar</span>
        {syncStatus && (
          <Pill variant={statusVariant(syncStatus)}>
            {statusLabel(syncStatus)}
          </Pill>
        )}
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        {htmlLink && (
          <a
            href={htmlLink}
            target="_blank"
            rel="noreferrer"
            className="text-oak hover:underline"
          >
            Abrir evento no Google
          </a>
        )}
        {meetLink && (
          <a
            href={meetLink}
            target="_blank"
            rel="noreferrer"
            className="text-oak hover:underline"
          >
            Entrar no Google Meet
          </a>
        )}
      </div>
      {syncError && syncStatus === "pending" && (
        <p className="text-xs text-mute">{syncError}</p>
      )}
      {showRetry && (
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={handleRetry}
          className="text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.75} />
          {pending ? "Sincronizando..." : "Tentar sincronizar de novo"}
        </Button>
      )}
      {error && (
        <p className="text-xs text-critical" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}