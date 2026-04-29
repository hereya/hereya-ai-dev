import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listMyWorkspaces, HereyaCloudError } from "../hereya-client.js";

export function registerListWorkspacesTool(server: McpServer) {
  server.registerTool(
    "list_authorized_workspaces",
    {
      title: "List authorized Hereya workspaces",
      description:
        "List the Hereya workspaces the connected user authorized this MCP " +
        "server to access during OAuth consent. Use this to discover which " +
        "workspaces you can mint short-lived CLI tokens for.\n\n" +
        "The returned set reflects the user's OAuth consent — it is the " +
        "exact set of workspaces the user picked when connecting this server " +
        "and may be smaller than what the user actually owns. If the user " +
        "expects a workspace to be here and it is not, ask them to disconnect " +
        "and reconnect this MCP server to update the consent set.\n\n" +
        "Each workspace has a `markedForDeployment` flag:\n" +
        "  - `false` → development / default workspaces (use as `-w` for " +
        "`hereya init` and `hereya up`).\n" +
        "  - `true` → deploy workspaces (use as `--deploy-workspace` at init " +
        "time and `-w` for `hereya deploy`).\n\n" +
        "Filter on this flag when asking the user to pick a default vs a " +
        "deploy workspace.\n\n" +
        "This tool is one of three — pair it with `mint_workspace_token` and " +
        "`get_instructions` to drive the full Hereya app lifecycle. If you " +
        "are not sure how to use the workspaces returned here, call " +
        "`get_instructions` (no arguments) to see the catalog of available " +
        "workflow guides.",
      inputSchema: {},
    },
    async (_args, { authInfo }) => {
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
        const result = await listMyWorkspaces(token);
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
