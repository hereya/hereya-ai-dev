import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mintWorkspaceToken, HereyaCloudError } from "../hereya-client.js";

export function registerMintTokenTool(server: McpServer) {
  server.registerTool(
    "mint_workspace_token",
    {
      title: "Mint a workspace-scoped Hereya CLI token",
      description:
        "Mint a short-lived (≤1 hour) Hereya CLI token scoped to a single " +
        "workspace. Pass the returned `token` to any `hereya` CLI command via " +
        "`--token <token>` (e.g. `npx -y hereya-cli up --token <token>`).\n\n" +
        "Mint immediately before each CLI invocation — do NOT cache tokens " +
        "across multiple commands or store them. The server caps lifetime at " +
        "1 hour and there is no refresh: when a CLI command fails with an " +
        "auth/expired-token error, simply call this tool again and retry the " +
        "command.\n\n" +
        "Inputs:\n" +
        "  - `workspace_id`: a workspace ID returned by " +
        "`list_authorized_workspaces`.\n\n" +
        "Errors:\n" +
        "  - 401 → the user's OAuth session is invalid; they must reconnect " +
        "this MCP server.\n" +
        "  - 403 → the requested workspace is not in the user's consented " +
        "set. Tell the user to disconnect and reconnect this MCP server and " +
        "include the missing workspace in the consent screen.\n\n" +
        "If you are about to run a Hereya CLI command and aren't sure of the " +
        "exact flags or the right workspace to mint for, call `get_instructions` " +
        "first — it returns the canonical step-by-step workflow.",
      inputSchema: {
        workspace_id: z
          .string()
          .describe(
            "Workspace ID from `list_authorized_workspaces` (the `id` field on a workspace entry)."
          ),
      },
    },
    async ({ workspace_id }, { authInfo }) => {
      const token = (authInfo as { token?: string } | undefined)?.token ?? "";
      if (!token) {
        return {
          isError: true as const,
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: {
                  code: "UNAUTHENTICATED",
                  message:
                    "No bearer token in MCP request. The user must authorize this MCP server via OAuth before any tool can be called.",
                },
              }),
            },
          ],
        };
      }

      try {
        const result = await mintWorkspaceToken(token, workspace_id);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result),
            },
          ],
        };
      } catch (err) {
        if (err instanceof HereyaCloudError) {
          return {
            isError: true as const,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: {
                    code: `HTTP_${err.status}`,
                    message: err.body || err.message,
                  },
                }),
              },
            ],
          };
        }
        return {
          isError: true as const,
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: {
                  code: "UNEXPECTED_ERROR",
                  message: (err as Error).message ?? String(err),
                },
              }),
            },
          ],
        };
      }
    }
  );
}
