# Rollout: repository_links + client tooling (PR #185)

## Risco

O app em `main` **antes** do merge pode ler/escrever `git_repository_url` se a migration `20261108030000` já estiver aplicada. A fase 1 **não** remove essas colunas — o app antigo continua funcionando.

## Ordem segura

| Passo | Quando | Migration / deploy |
|-------|--------|-------------------|
| A | Opcional | `20261108030000_git_repository_url.sql` (só se ainda não aplicou) |
| B | **Antes** ou **depois** do merge; app antigo segue ok | `20261108040000_repository_links_and_client_tooling.sql` |
| C | **Merge + deploy Vercel** do código que usa só `repository_links` / tooling tables | PR #185 |
| D | **Só após C em produção** | `20261108050000_drop_legacy_git_repository_url_columns.sql` |

Entre B e C: dados legados existem nas **duas** formas (coluna + linha em `repository_links`). O app antigo usa a coluna; o app novo usa a tabela. Sem perda.

Entre C e D: colunas legadas ficam órfãs mas inofensivas até o passo D.

## Rollback

- Antes de D: reverter deploy para build anterior — colunas legadas ainda existem se A foi aplicada.
- Após D: rollback de app exige re-adicionar colunas (não automatizado) — por isso D é **último**.
