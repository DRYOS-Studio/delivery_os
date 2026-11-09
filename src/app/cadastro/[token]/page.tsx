import { PublicClientRegistrationForm } from "@/components/domain/PublicClientRegistrationForm";
import { Card } from "@/components/ui/Card";
import { getPublicRegistrationPrefill } from "@/lib/db/queries/client-registration-public";

type PageProps = {
  params: Promise<{ token: string }>;
};

export const dynamic = "force-dynamic";

export default async function CadastroTokenPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { token: rawParam } = await params;
  const token = decodeURIComponent(rawParam);

  if (process.env.NODE_ENV === "development" && token === "dev-preview") {
    return (
      <>
        <div className="mb-6">
          <h1 className="font-display text-2xl text-ink font-semibold">
            Olá, Cliente Demo
          </h1>
          <p className="text-sm text-mute mt-2">
            Preencha os dados abaixo para seguirmos com o contrato.
          </p>
        </div>
        <PublicClientRegistrationForm
          token={token}
          prefillPhone="21999998888"
        />
      </>
    );
  }

  let prefill;
  try {
    prefill = await getPublicRegistrationPrefill(token);
  } catch {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-mute">Não foi possível carregar o cadastro.</p>
      </Card>
    );
  }

  if (!prefill) {
    return (
      <Card className="p-6 text-center">
        <h1 className="font-display text-xl text-ink font-semibold mb-2">
          Link inválido
        </h1>
        <p className="text-sm text-mute">
          Este link não existe ou já foi substituído. Peça um novo link à equipe
          DRYOS.
        </p>
      </Card>
    );
  }

  if (prefill.status === "cancelado") {
    return (
      <Card className="p-6 text-center">
        <h1 className="font-display text-xl text-ink font-semibold mb-2">
          Convite cancelado
        </h1>
        <p className="text-sm text-mute">
          Este cadastro foi cancelado. Entre em contato com a DRYOS se precisar de
          um novo link.
        </p>
      </Card>
    );
  }

  if (prefill.status === "expirado") {
    return (
      <Card className="p-6 text-center">
        <h1 className="font-display text-xl text-ink font-semibold mb-2">
          Convite expirado
        </h1>
        <p className="text-sm text-mute">
          O prazo deste link encerrou. Solicite um novo convite à equipe DRYOS.
        </p>
      </Card>
    );
  }

  if (prefill.status === "preenchido" || prefill.status === "aprovado") {
    return (
      <Card className="p-6 text-center">
        <h1 className="font-display text-xl text-ink font-semibold mb-2">
          Cadastro já enviado
        </h1>
        <p className="text-sm text-mute">
          Recebemos seus dados. A equipe DRYOS está revisando e entrará em
          contato se necessário.
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-ink font-semibold">
          Olá, {prefill.prefillContactName}
        </h1>
        <p className="text-sm text-mute mt-2">
          Preencha os dados abaixo para seguirmos com o contrato. Leva cerca de
          10 minutos.
        </p>
        {prefill.inviteNote && (
          <p className="text-sm text-ink-soft mt-3 bg-surface rounded px-3 py-2 border border-line">
            {prefill.inviteNote}
          </p>
        )}
      </div>
      <PublicClientRegistrationForm
        token={token}
        prefillPhone={prefill.prefillContactPhone}
      />
    </>
  );
}
