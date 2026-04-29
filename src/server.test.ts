import { describe, expect, it } from "vitest";
import { createServer } from "./server.js";

interface RegistryAccess {
  _registeredTools: Record<string, unknown>;
  _registeredPrompts: Record<string, unknown>;
}

describe("createServer", () => {
  it("registers all three tools", () => {
    const server = createServer();
    const registry = server as unknown as RegistryAccess;
    const toolNames = Object.keys(registry._registeredTools);
    expect(toolNames).toEqual(
      expect.arrayContaining([
        "get_instructions",
        "list_authorized_workspaces",
        "mint_workspace_token",
      ])
    );
  });

  it("registers all four prompts", () => {
    const server = createServer();
    const registry = server as unknown as RegistryAccess;
    const promptNames = Object.keys(registry._registeredPrompts);
    expect(promptNames).toEqual(
      expect.arrayContaining([
        "create-app",
        "develop-app",
        "deploy-app",
        "git-workflow",
      ])
    );
  });
});
