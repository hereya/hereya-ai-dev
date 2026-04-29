import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("list_authorized_workspaces tool", () => {
  it("returns the cloud payload as a single text content item", async () => {
    const payload = {
      workspaces: [
        {
          id: "ws_1",
          name: "dev",
          orgId: "org_1",
          orgName: "acme",
          markedForDeployment: false,
        },
      ],
    };
    const fetchMock = mockFetchOnce({ body: JSON.stringify(payload) });

    const server = createServer();
    const tool = getTool(server, "list_authorized_workspaces");

    const result = (await tool.handler({}, { authInfo: { token: "u-tok" } })) as {
      isError?: boolean;
      content: Array<{ type: string; text: string }>;
    };

    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.type).toBe("text");
    expect(JSON.parse(result.content[0]!.text)).toEqual(payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    const headers = (init as unknown as { headers: Record<string, string> })
      .headers;
    expect(headers.authorization).toBe("Bearer u-tok");
  });

  it("surfaces 401 from the cloud as an isError tool result", async () => {
    mockFetchOnce({ status: 401, body: "missing_token" });

    const server = createServer();
    const tool = getTool(server, "list_authorized_workspaces");

    const result = (await tool.handler({}, { authInfo: { token: "u-tok" } })) as {
      isError?: boolean;
      content: Array<{ type: string; text: string }>;
    };

    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.type).toBe("text");
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed).toEqual({
      error: { code: "HTTP_401", message: "missing_token" },
    });
  });

  it("returns an UNAUTHENTICATED error when no bearer token is present", async () => {
    const server = createServer();
    const tool = getTool(server, "list_authorized_workspaces");

    const result = (await tool.handler({}, { authInfo: { token: "" } })) as {
      isError?: boolean;
      content: Array<{ type: string; text: string }>;
    };

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.error.code).toBe("UNAUTHENTICATED");
  });
});
