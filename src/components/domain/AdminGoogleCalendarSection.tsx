"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  disconnectGoogleCalendarAction,
  listGoogleCalendarsForAdminAction,
  setGoogleCalendarIdAction,
} from "@/lib/actions/google-calendar";
import type { GoogleCalendarConnectionPublic } from "@/lib/db/queries/google-calendar-integration";

type Props = {
  configured: boolean;
  connection: GoogleCalendarConnectionPublic;
};

export function AdminGoogleCalendarSection({
  configured,
  connection,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<
    { id: string; summary: string; primary?: boolean }[]
  >([]);
  const [selected, setSelected] = useState(connection.calendarId ?? "primary");
  const [pending, startTransition] = useTransition();

  function handleLoadCalendars(): void {
    setGeneralError(null);
    startTransition(async () => {
      const res = await listGoogleCalendarsForAdminAction();
      if (!res.ok) {
        setGeneralError(res.error);
        return;
      }
      setCalendars(res.data);
      if (res.data.length > 0 && !res.data.some((c) => c.id === selected)) {
        const primary = res.data.find((c) => c.primary) ?? res.data[0]!;
        setSelected(primary.id);
      }
    });
  }

  function handleSaveCalendar(): void {
    setGeneralError(null);
    const row = calendars.find((c) => c.id === selected);
    startTransition(async () => {
      const res = await setGoogleCalendarIdAction(
        selected,
        row?.summary ?? null,
      );
      if (!res.ok) {
        setGeneralError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function handleDisconnect(): void {
    if (
      !window.confirm(
        "Desconectar Google Calendar? Reuniões futuras não sincronizarão até reconectar.",
      )
    ) {
      return;
    }
    setGeneralError(null);
    startTransition(async () => {
      const res = await disconnectGoogleCalendarAction();
      if (!res.ok) {
        setGeneralError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card className="mb-8 space-y-4">
      <header>
        <h2 className="font-display text-lg font-semibold">Google Calendar</h2>
        <p className="text-sm text-mute mt-1">
          Conexão organizacional para criar eventos ao agendar reuniões no
          Delivery (com Google Meet).
        </p>
      </header>

      {!configured && (
        <p className="text-sm text-warning">
          Variáveis <span className="font-mono">GOOGLE_CLIENT_ID</span> e{" "}
          <span className="font-mono">GOOGLE_CLIENT_SECRET</span> não estão
          definidas neste ambiente.
        </p>
      )}

      {connection.connected ? (
        <div className="space-y-3">
          <p className="text-sm">
            Conectado como{" "}
            <span className="font-medium text-ink">{connection.accountEmail}</span>
            {connection.calendarSummary ? (
              <>
                {" "}
                · Calendário:{" "}
                <span className="font-mono text-xs">
                  {connection.calendarSummary}
                </span>{" "}
                <span className="text-mute">({connection.calendarId})</span>
              </>
            ) : (
              connection.calendarId && (
                <span className="font-mono text-xs text-mute">
                  {" "}
                  · {connection.calendarId}
                </span>
              )
            )}
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={handleLoadCalendars}
            >
              Listar calendários
            </Button>
            {calendars.length > 0 && (
              <>
                <label className="text-sm flex flex-col gap-1">
                  <span className="font-mono text-[10px] text-mute uppercase">
                    Calendário alvo
                  </span>
                  <select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    disabled={pending}
                    className="rounded border border-line bg-bg px-2 py-1.5 text-sm min-w-[220px]"
                  >
                    {calendars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.summary}
                        {c.primary ? " (principal)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  variant="primary"
                  disabled={pending}
                  onClick={handleSaveCalendar}
                >
                  Salvar calendário
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={handleDisconnect}
              className="text-critical"
            >
              Desconectar
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-mute">
          Nenhuma conta Google conectada.
          {configured ? (
            <>
              {" "}
              <Link
                href="/api/integrations/google-calendar/connect?returnTo=/admin"
                className="text-oak hover:underline"
              >
                Conectar conta Google
              </Link>
            </>
          ) : null}
        </p>
      )}

      {generalError && (
        <p className="text-sm text-critical" role="alert">
          {generalError}
        </p>
      )}
    </Card>
  );
}