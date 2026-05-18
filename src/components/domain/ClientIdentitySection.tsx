import type { ClientDetail } from "@/lib/db/queries/clients";
import { formatCep, formatCnpj } from "@/lib/utils/mask";

type Props = {
  client: ClientDetail;
};

function hasAny(...vals: Array<string | null | undefined>): boolean {
  return vals.some((v) => v !== null && v !== undefined && v !== "");
}

function formatAddressLine(client: ClientDetail): string | null {
  const parts: string[] = [];
  if (client.address_street) {
    let line = client.address_street;
    if (client.address_number) line += `, ${client.address_number}`;
    if (client.address_complement) line += ` — ${client.address_complement}`;
    parts.push(line);
  }
  if (client.address_district) parts.push(client.address_district);
  const cityState = [client.address_city, client.address_state]
    .filter(Boolean)
    .join(" - ");
  if (cityState) parts.push(cityState);
  const cep = formatCep(client.address_zip);
  if (cep) parts.push(`CEP ${cep}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="font-mono text-[10px] uppercase tracking-wide text-mute">
        {label}
      </p>
      <p className="text-sm text-ink">{value}</p>
    </div>
  );
}

export function ClientIdentitySection({ client }: Props) {
  const hasPJ = hasAny(client.legal_name, client.cnpj, client.inscricao_estadual);
  const hasContact = hasAny(
    client.primary_contact_name,
    client.primary_contact_email,
    client.primary_contact_phone,
  );
  const hasAddress = hasAny(
    client.address_street,
    client.address_number,
    client.address_complement,
    client.address_district,
    client.address_city,
    client.address_state,
    client.address_zip,
  );

  if (!hasPJ && !hasContact && !hasAddress) return null;

  const cnpj = formatCnpj(client.cnpj);
  const addressLine = formatAddressLine(client);

  return (
    <section className="mb-7">
      <h2 className="font-display text-lg font-semibold text-ink mb-4">
        Identificação & Contato
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {hasPJ && (
          <div className="bg-card border border-line rounded p-4 space-y-3">
            <h3 className="font-mono text-[10px] uppercase tracking-wide text-mute">
              Pessoa Jurídica
            </h3>
            {client.legal_name && (
              <Row label="Razão social" value={client.legal_name} />
            )}
            {cnpj && <Row label="CNPJ" value={cnpj} />}
            {client.inscricao_estadual && (
              <Row label="Inscrição Estadual" value={client.inscricao_estadual} />
            )}
          </div>
        )}

        {hasContact && (
          <div className="bg-card border border-line rounded p-4 space-y-3">
            <h3 className="font-mono text-[10px] uppercase tracking-wide text-mute">
              Contato
            </h3>
            {client.primary_contact_name && (
              <Row label="Nome" value={client.primary_contact_name} />
            )}
            {client.primary_contact_email && (
              <Row
                label="E-mail"
                value={
                  <a
                    href={`mailto:${client.primary_contact_email}`}
                    className="text-oak hover:underline"
                  >
                    {client.primary_contact_email}
                  </a>
                }
              />
            )}
            {client.primary_contact_phone && (
              <Row
                label="Telefone"
                value={
                  <a
                    href={`tel:${client.primary_contact_phone}`}
                    className="text-oak hover:underline"
                  >
                    {client.primary_contact_phone}
                  </a>
                }
              />
            )}
          </div>
        )}

        {hasAddress && addressLine && (
          <div className="bg-card border border-line rounded p-4 space-y-3">
            <h3 className="font-mono text-[10px] uppercase tracking-wide text-mute">
              Endereço
            </h3>
            <p className="text-sm text-ink leading-relaxed">{addressLine}</p>
          </div>
        )}
      </div>
    </section>
  );
}
