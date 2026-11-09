import { Card } from "@/components/ui/Card";
import type { ClientRegistrationSubmission } from "@/lib/validators/client-registration";

type Props = {
  submission: ClientRegistrationSubmission;
};

function Row({ label, value }: { label: string; value: string | undefined }): React.JSX.Element | null {
  if (!value?.trim()) return null;
  return (
    <div className="py-2 border-b border-line last:border-0">
      <dt className="font-mono text-[10px] text-mute uppercase">{label}</dt>
      <dd className="text-sm text-ink-soft mt-0.5 break-words">{value}</dd>
    </div>
  );
}

export function RegistrationSubmissionReviewSummary({
  submission,
}: Props): React.JSX.Element {
  if (submission.person_type === "pf") {
    return (
      <Card className="p-5 space-y-1">
        <h3 className="font-display text-sm text-ink font-semibold mb-3">
          Pessoa física
        </h3>
        <dl>
          <Row label="Nome completo" value={submission.full_name} />
          <Row label="Profissão" value={submission.profession} />
          <Row label="Estado civil" value={submission.marital_status} />
          <Row label="CPF" value={submission.cpf} />
          <Row label="E-mail formal" value={submission.formal_email} />
        </dl>
        <AddressBlock submission={submission} />
        <ContactsBlock submission={submission} />
        <SoftwareBlock items={submission.software_items} />
      </Card>
    );
  }

  return (
    <Card className="p-5 space-y-1">
      <h3 className="font-display text-sm text-ink font-semibold mb-3">Empresa</h3>
      <dl>
        <Row label="Razão social" value={submission.legal_name} />
        <Row label="Nome fantasia" value={submission.trade_name} />
        <Row label="CNPJ" value={submission.cnpj} />
      </dl>
      <h4 className="font-display text-xs text-ink font-semibold mt-4 mb-2">
        Representante legal
      </h4>
      <dl>
        <Row label="Nome" value={submission.legal_representative_name} />
        <Row label="Cargo" value={submission.legal_representative_role} />
        <Row label="CPF" value={submission.legal_representative_cpf} />
        <Row
          label="Estado civil"
          value={submission.legal_representative_marital_status}
        />
        <Row label="E-mail" value={submission.legal_representative_email} />
      </dl>
      <AddressBlock submission={submission} />
      <ContactsBlock submission={submission} />
      <SoftwareBlock items={submission.software_items} />
    </Card>
  );
}

function AddressBlock({
  submission,
}: {
  submission: ClientRegistrationSubmission;
}): React.JSX.Element {
  return (
    <>
      <h4 className="font-display text-xs text-ink font-semibold mt-4 mb-2">
        Endereço
      </h4>
      <dl>
        <Row
          label="CEP / logradouro"
          value={`${submission.address_zip} — ${submission.address_street}, ${submission.address_number}`}
        />
        <Row label="Complemento" value={submission.address_complement} />
        <Row
          label="Bairro / cidade"
          value={`${submission.address_district} — ${submission.address_city}/${submission.address_state}`}
        />
      </dl>
    </>
  );
}

function ContactsBlock({
  submission,
}: {
  submission: ClientRegistrationSubmission;
}): React.JSX.Element {
  return (
    <>
      <h4 className="font-display text-xs text-ink font-semibold mt-4 mb-2">
        Contatos
      </h4>
      <dl>
        <Row
          label="Ponto focal"
          value={`${submission.focal_point_name} · ${submission.focal_point_email} · ${submission.focal_point_phone}`}
        />
        <Row
          label="Financeiro"
          value={`${submission.financial_contact_name} · ${submission.financial_contact_email} · ${submission.financial_contact_phone}`}
        />
      </dl>
    </>
  );
}

function SoftwareBlock({
  items,
}: {
  items: ClientRegistrationSubmission["software_items"];
}): React.JSX.Element | null {
  if (!items?.length) return null;
  return (
    <>
      <h4 className="font-display text-xs text-ink font-semibold mt-4 mb-2">
        Ferramentas
      </h4>
      <ul className="text-sm text-ink-soft space-y-2">
        {items.map((item, i) => (
          <li key={`${item.name}-${i}`}>
            <span className="font-medium">{item.name}</span>
            {item.url ? (
              <span className="text-mute text-xs block">{item.url}</span>
            ) : null}
            <span className="text-mute text-xs block">{item.purpose}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
