export function buildWhatsAppInviteMessage(params: {
  contactName: string;
  registrationUrl: string;
}): string {
  const name = params.contactName.trim();
  return (
    `Olá${name ? `, ${name}` : ""}! Aqui é a equipe DRYOS.\n\n` +
    `Para seguir com nosso contrato, precisamos que você preencha o cadastro da sua empresa/pessoa no link abaixo (leva cerca de 10 minutos):\n\n` +
    `${params.registrationUrl}\n\n` +
    `Se tiver qualquer dúvida, pode responder por aqui. Obrigada!`
  );
}
