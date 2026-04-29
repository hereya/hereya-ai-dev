import { describe, expect, it } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createServer } from "../server.js";

interface RegisteredToolLike {
  handler: (args: unknown, extra: unknown) => unknown | Promise<unknown>;
}

function getTool(server: McpServer, name: string): RegisteredToolLike {
  const tools = (server as unknown as {
    _registeredTools: Record<string, RegisteredToolLike>;
  })._registeredTools;
  const tool = tools[name];
  if (!tool) {
    throw new Error(`tool ${name} not registered`);
  }
  return tool;
}

describe("get_instructions tool", () => {
  it("returns the catalog when called with no arguments", async () => {
    const server = createServer();
    const tool = getTool(server, "get_instructions");

    const result = (await tool.handler({}, { authInfo: { token: "u-tok" } })) as {
      isError?: boolean;
      content: Array<{ type: string; text: string }>;
    };

    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(1);
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed.topics).toBeDefined();
    expect(Array.isArray(parsed.topics)).toBe(true);
    const slugs = parsed.topics.map((t: { slug: string }) => t.slug);
    expect(slugs).toEqual([
      "create-app",
      "develop-app",
      "deploy-app",
      "git-workflow",
    ]);
    for (const t of parsed.topics as Array<{
      slug: string;
      title: string;
      summary: string;
    }>) {
      expect(t.title).toBeTruthy();
      expect(t.summary).toBeTruthy();
    }
    expect(parsed.next).toMatch(/topic/);
  });

  it("returns the markdown body when called with a known topic", async () => {
    const server = createServer();
    const tool = getTool(server, "get_instructions");

    const result = (await tool.handler(
      { topic: "create-app" },
      { authInfo: { token: "u-tok" } }
    )) as {
      isError?: boolean;
      content: Array<{ type: string; text: string }>;
    };

    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.type).toBe("text");
    // create-app.md begins with "# Create a new Hereya app"
    expect(result.content[0]!.text).toMatch(/Create a new Hereya app/);
    expect(result.content[0]!.text).toMatch(/hereya init/);
  });

  it("returns UNKNOWN_TOPIC for an unrecognized topic", async () => {
    const server = createServer();
    const tool = getTool(server, "get_instructions");

    const result = (await tool.handler(
      { topic: "no-such-topic" },
      { authInfo: { token: "u-tok" } }
    )) as {
      isError?: boolean;
      content: Array<{ type: string; text: string }>;
    };

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.error.code).toBe("UNKNOWN_TOPIC");
    expect(parsed.error.message).toMatch(/create-app/);
  });
});
