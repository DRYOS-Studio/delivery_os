# Investigação: discovery 8 ferramentas vs 93 no HTTP

**Contexto:** pós-merge PR #183 (`main` @ `8fdb2f1863e3d934eced92eff80505dcdbfc60dd`).  
**Sintoma:** HTTP direto em produção → `initialize` 0.5.0 + `tools/list` 93; Grok Bot (`mcp-remote` 0.16.4, `--transport http-only`) e `GetDynamicTools` namespace `user-deliveryos` → 8 ferramentas com schemas **antigos** (`list_operations` só `limit`).  
**Chamadas:** `tools/call` (`get_operation`) funciona.

## Conclusão (repo DeliveryOS)

Não há, em `main`, filtragem de `tools/list` por token, escopo ou allowlist. Tokens MCP (`profile_agent_tokens`) guardam apenas `read`/`write`; escopo afeta **dispatch** em `tools/call`, não o catálogo.

O catálogo HTTP é sempre `MCP_TOOL_DEFINITIONS` (93 entradas em `src/lib/mcp/tools/registry.ts`), mapeado em `src/app/api/mcp/route.ts` no case `tools/list`.

## Origem exata dos “8”

Fingerprint **byte-a-byte** do sintoma = array inline `TOOLS` em `src/app/api/mcp/route.ts` **antes** do commit `5e3ddf4` (PR #183):

| # | Ferramenta |
|---|---|
| 1 | `list_operations` (`properties`: só `limit`) |
| 2 | `get_operation` |
| 3 | `list_tasks` |
| 4 | `get_task` |
| 5 | `create_task` |
| 6 | `update_task` |
| 7 | `change_task_status` |
| 8 | `add_task_comment` |

`serverInfo.version` nessa era: **0.2.0**. Catálogo atual: **0.5.0**, `list_operations` com `client_id` + `limit`.

Comando para reproduzir fingerprint legado:

```bash
git show '5e3ddf4^:src/app/api/mcp/route.ts' | rg 'name: "' 
```

## O que o servidor atual expõe

| Método | Comportamento |
|---|---|
| `GET /api/mcp` | `tool_count` = comprimento do registry (sem listar schemas) |
| `initialize` | `protocolVersion: 2024-11-05`, `capabilities.tools: {}`, `serverInfo.version: 0.5.0` |
| `tools/list` | Todas as 93 ferramentas; **sem** `nextCursor` / paginação |
| `notifications/initialized` | HTTP 202 |
| `discover` | **Não implementado** (só relevante se cliente negociar protocolo moderno e depender disso) |

Payload `tools/list` ~24 KiB JSON (medido localmente).

## O que **não** explica sozinho (precisa teste no host do Grok)

| Hipótese | Notas |
|---|---|
| Cache de token / snapshot no Postgres | **Descartada no código** — tabela não armazena lista de tools |
| Filtro RLS no `tools/list` | **Descartada** — rota não consulta banco para listar |
| `listChanged` ausente | Reconexão + novo token **deveria** refazer `tools/list`; não prova causalidade até comparar resposta HTTP na mesma máquina do conector |
| `mcp-remote` ignora tools inválidas | SDK pode **excluir** tools com `x-mcp-header` inválido em era moderna; nosso registry não usa isso — não reduziria exatamente para o conjunto legado de 8 |
| **Catálogo estático no conector Cursor/Grok** (`user-deliveryos`) | Compatível com: HTTP Rafael vê 93; UI discovery vê manifesto empacotado/desatualizado; `get_operation` ainda funciona por estar nos 8 |
| URL / deploy diferente no stdio | Mesmo host declarado, validar com `curl` na **mesma** VM do Grok |
| Cache local `mcp-remote` / ResponseCacheStore | Possível se `tools/list` falhar e cliente reutilizar entrada antiga — exige log `--debug` no conector |

## Próximo teste necessário (evidência decisiva)

Na máquina onde o Grok roda `mcp-remote` (sem expor o token em logs públicos):

```bash
# 1) Contagem e versão (substituir TOKEN)
curl -sS -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}' \
  https://delivery-os-phi.vercel.app/api/mcp | jq '.result.serverInfo'

curl -sS -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  https://delivery-os-phi.vercel.app/api/mcp | jq '.result.tools | length, .[0].name, .result.tools[] | select(.name=="list_operations") | .inputSchema.properties | keys'

# 2) mcp-remote com log (sem --silent) e comparar o que o proxy imprime após tools/list

# 3) tools/call de ferramenta FORA dos 8, ex. create_client_contract — se HTTP 200 no curl mas ausente na UI, confirma discovery desacoplada da execução
```

Interpretação:

- Se (1) retorna **93** e `list_operations` tem `client_id` → servidor OK; bug/downstream no conector ou namespace Cursor.
- Se (1) retorna **8** → roteamento, deploy ou edge naquele caminho (não o registry em `main`).

## Documentação desatualizada (não causa técnica, confunde humanos)

`docs/agent-supabase.md` §6.3 ainda documenta só as 8 ferramentas legadas.

## Testes automatizados (repo)

`src/lib/mcp/mcp-tools-list-protocol.test.ts` — garante registry > 8 e schema expandido de `list_operations`.
