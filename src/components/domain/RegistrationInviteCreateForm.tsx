"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createRegistrationInvitationAction } from "@/lib/actions/client-registration";
import { buildWhatsAppInviteMessage } from "@/lib/registration/whatsapp-message";
import {
  createInvitationSchema,
  type CreateInvitationInput,
} from "@/lib/validators/client-registration";
import type { z } from "zod";

type CreateInvitationFormInput = z.input<typeof createInvitationSchema>;

export function RegistrationInviteCreateForm(): React.JSX.Element {
  const router = useRouter();
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    id: string;
    registrationUrl: string;
    contactName: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateInvitationFormInput, undefined, CreateInvitationInput>({
    resolver: zodResolver(createInvitationSchema),
  });

  async function onSubmit(data: CreateInvitationInput): Promise<void> {
    setGeneralError(null);
    const fd = new FormData();
    fd.set("prefill_contact_name", data.prefill_contact_name);
    fd.set("prefill_contact_phone", data.prefill_contact_phone);
    fd.set("invite_note", data.invite_note ?? "");

    const result = await createRegistrationInvitationAction(fd);
    if (!result.ok) {
      setGeneralError(result.error);
      return;
    }

    setCreated({
      id: result.data.id,
      registrationUrl: result.data.registrationUrl,
      contactName: data.prefill_contact_name,
    });
    router.refresh();
  }

  async function copyText(text: string): Promise<void> {
    await navigator.clipboard.writeText(text);
  }

  const whatsappText = created
    ? buildWhatsAppInviteMessage({
        contactName: created.contactName,
        registrationUrl: created.registrationUrl,
      })
    : "";

  if (created) {
    return (
      <Card className="p-6 space-y-4">
        <h2 className="font-display text-lg text-ink font-semibold">
          Convite criado
        </h2>
        <p className="text-sm text-mute">Copie o link ou a mensagem para WhatsApp.</p>
        <div className="bg-surface border border-line rounded p-3 font-mono text-xs break-all">
          {created.registrationUrl}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" onClick={() => void copyText(created.registrationUrl)}>
            Copiar link
          </Button>
          <Button type="button" variant="ghost" onClick={() => void copyText(whatsappText)}>
            Copiar mensagem para WhatsApp
          </Button>
        </div>
        <pre className="text-xs text-mute whitespace-pre-wrap bg-surface border border-line rounded p-3">
          {whatsappText}
        </pre>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
        {generalError && (
          <p className="text-sm text-critical">{generalError}</p>
        )}
        <div>
          <label className="font-mono text-[10px] text-mute uppercase" htmlFor="prefill_contact_name">
            Nome do contato
          </label>
          <input
            id="prefill_contact_name"
            className="mt-1 w-full bg-card border border-line rounded px-3 py-2 text-sm"
            {...register("prefill_contact_name")}
          />
          {errors.prefill_contact_name && (
            <p className="text-xs text-critical mt-1">
              {errors.prefill_contact_name.message}
            </p>
          )}
        </div>
        <div>
          <label className="font-mono text-[10px] text-mute uppercase" htmlFor="prefill_contact_phone">
            WhatsApp / telefone
          </label>
          <input
            id="prefill_contact_phone"
            className="mt-1 w-full bg-card border border-line rounded px-3 py-2 text-sm"
            {...register("prefill_contact_phone")}
          />
          {errors.prefill_contact_phone && (
            <p className="text-xs text-critical mt-1">
              {errors.prefill_contact_phone.message}
            </p>
          )}
        </div>
        <div>
          <label className="font-mono text-[10px] text-mute uppercase" htmlFor="invite_note">
            Observação (opcional)
          </label>
          <textarea
            id="invite_note"
            rows={3}
            className="mt-1 w-full bg-card border border-line rounded px-3 py-2 text-sm"
            {...register("invite_note")}
          />
        </div>
        <Button type="submit" variant="sage" disabled={isSubmitting}>
          Gerar link de cadastro
        </Button>
      </form>
    </Card>
  );
}
