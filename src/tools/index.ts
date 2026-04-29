import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListWorkspacesTool } from "./workspaces.js";
import { registerMintTokenTool } from "./token.js";
import { registerGetInstructionsTool } from "./instructions.js";

export function registerTools(server: McpServer) {
  registerGetInstructionsTool(server);
  registerListWorkspacesTool(server);
  registerMintTokenTool(server);
}
