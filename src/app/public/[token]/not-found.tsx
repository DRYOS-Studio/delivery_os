// 404 da superfície pública: cobre o notFound() do resolver de token
// (inválido, revogado, expirado ou operação arquivada — resposta uniforme,
// sem oráculo de existência). Sem chrome interno, sem link pro app.
export default function PublicNotFound() {
  return (
    <div className="py-24 text-center">
      <p className="font-mono text-[10px] uppercase tracking-wider text-mute mb-3">
        404
      </p>
      <h1 className="font-display text-2xl font-semibold text-ink mb-2">
        Link inválido ou expirado
      </h1>
      <p className="text-sm text-mute">
        Peça um novo link de acesso ao time DRYOS.
      </p>
    </div>
  );
}
