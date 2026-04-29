import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListWorkspacesTool } from "./workspaces.js";
import { registerMintTokenTool } from "./token.js";

export function registerTools(server: McpServer) {
  registerListWorkspacesTool(server);
  registerMintTokenTool(server);
}
