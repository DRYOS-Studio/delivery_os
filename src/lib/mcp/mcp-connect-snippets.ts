/** Snippets de conexão MCP para Claude Desktop / Claude Code (sem secrets embutidos). */

export function buildMcpRemoteClaudeDesktopConfig(
  appUrl: string,
  bearerPlaceholder = "<SEU_TOKEN_mcp_agt_…>",
): string {
  const endpoint = `${appUrl.replace(/\/$/, "")}/api/mcp`;
  return JSON.stringify(
    {
      mcpServers: {
        "dryos-delivery": {
          command: "npx",
          args: [
            "-y",
            "mcp-remote",
            endpoint,
            "--header",
            `Authorization: Bearer ${bearerPlaceholder}`,
          ],
        },
      },
    },
    null,
    2,
  );
}

export function buildClaudeMcpAddCommand(
  appUrl: string,
  bearerPlaceholder = "<SEU_TOKEN_mcp_agt_…>",
): string {
  const endpoint = `${appUrl.replace(/\/$/, "")}/api/mcp`;
  return [
    "claude mcp add dryos-delivery \\",
    `  --transport http ${endpoint} \\`,
    `  --header "Authorization: Bearer ${bearerPlaceholder}"`,
  ].join("\n");
}
