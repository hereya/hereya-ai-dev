import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createServer } from "../server.js";

const ORIGINAL_API_URL = process.env.HEREYA_CLOUD_API_URL;

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

function mockFetchOnce(responseInit: { status?: number; body?: string } = {}) {
  const status = responseInit.status ?? 200;
  const body = responseInit.body ?? "";
  const fetchMock = vi.fn(
    async (_url: string, _init?: RequestInit) => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => body,
    })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  delete process.env.HEREYA_CLOUD_API_URL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL_API_URL === undefined) {
    delete process.env.HEREYA_CLOUD_API_URL;
  } else {
    process.env.HEREYA_CLOUD_API_URL = ORIGINAL_API_URL;
  }
});

describe("mint_workspace_token tool", () => {
  it("returns the minted token payload on 200", async () => {
    const payload = {
      token: "cli-tok",
      expires_at: "2026-04-29T13:00:00.000Z",
      workspace: {
        id: "ws_1",
        name: "dev",
        orgId: "org_1",
        orgName: "acme",
        markedForDeployment: false,
      },
    };
    const fetchMock = mockFetchOnce({ body: JSON.stringify(payload) });

    const server = createServer();
    const tool = getTool(server, "mint_workspace_token");

    const result = (await tool.handler(
      { workspace_id: "ws_1" },
      { authInfo: { token: "u-tok" } }
    )) as {
      isError?: boolean;
      content: Array<{ type: string; text: string }>;
    };

    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.type).toBe("text");
    expect(JSON.parse(result.content[0]!.text)).toEqual(payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://cloud.hereya.dev/api/tokens/workspace");
    const initObj = init as unknown as {
      method: string;
      headers: Record<string, string>;
      body: string;
    };
    expect(initObj.method).toBe("POST");
    expect(initObj.headers.authorization).toBe("Bearer u-tok");
    expect(JSON.parse(initObj.body)).toEqual({ workspace_id: "ws_1" });
  });

  it("surfaces 403 from the cloud verbatim as isError", async () => {
    mockFetchOnce({
      status: 403,
      body: "workspace not in consent set",
    });

    const server = createServer();
    const tool = getTool(server, "mint_workspace_token");

    const result = (await tool.handler(
      { workspace_id: "ws_other" },
      { authInfo: { token: "u-tok" } }
    )) as {
      isError?: boolean;
      content: Array<{ type: string; text: string }>;
    };

    expect(result.isError).toBe(true);
    expect(result.content[0]!.type).toBe("text");
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed).toEqual({
      error: {
        code: "HTTP_403",
        message: "workspace not in consent set",
      },
    });
  });

  it("rejects an empty payload via Zod input validation", async () => {
    const server = createServer();
    const client = new Client({ name: "test-client", version: "0.0.0" });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      const result = await client.callTool({
        name: "mint_workspace_token",
        arguments: {},
      });
      // The SDK surfaces validation errors as isError tool results.
      expect(result.isError).toBe(true);
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0]!.type).toBe("text");
      // Should mention workspace_id (the missing required field).
      expect(content[0]!.text).toMatch(/workspace_id/i);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
