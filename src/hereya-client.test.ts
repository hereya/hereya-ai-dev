import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HereyaCloudError,
  listMyWorkspaces,
  mintWorkspaceToken,
} from "./hereya-client.js";

const ORIGINAL_API_URL = process.env.HEREYA_CLOUD_API_URL;

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

describe("listMyWorkspaces", () => {
  it("hits the default base URL and forwards the bearer token", async () => {
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

    const result = await listMyWorkspaces("u-tok");

    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://cloud.hereya.dev/api/workspaces/me");
    const initObj = init as unknown as {
      method: string;
      headers: Record<string, string>;
    };
    expect(initObj.method).toBe("GET");
    expect(initObj.headers.authorization).toBe("Bearer u-tok");
  });

  it("honors HEREYA_CLOUD_API_URL when set (and strips trailing slash)", async () => {
    process.env.HEREYA_CLOUD_API_URL = "https://staging.hereya.dev/";
    const fetchMock = mockFetchOnce({ body: JSON.stringify({ workspaces: [] }) });

    await listMyWorkspaces("u-tok");

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://staging.hereya.dev/api/workspaces/me");
  });

  it("throws HereyaCloudError carrying status and raw body on non-2xx", async () => {
    mockFetchOnce({ status: 401, body: "unauthorized" });

    await expect(listMyWorkspaces("u-tok")).rejects.toMatchObject({
      name: "HereyaCloudError",
      status: 401,
      body: "unauthorized",
    });
    await expect(listMyWorkspaces("u-tok")).rejects.toBeInstanceOf(
      HereyaCloudError
    );
  });
});

describe("mintWorkspaceToken", () => {
  it("POSTs { workspace_id } with bearer token and parses JSON on 200", async () => {
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

    const result = await mintWorkspaceToken("u-tok", "ws_1");

    expect(result).toEqual(payload);
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
    expect(initObj.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(initObj.body)).toEqual({ workspace_id: "ws_1" });
  });

  it("falls back to https://cloud.hereya.dev when env var is unset", async () => {
    const fetchMock = mockFetchOnce({
      body: JSON.stringify({ token: "t", expires_at: "x" }),
    });

    await mintWorkspaceToken("u-tok", "ws_1");

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url).startsWith("https://cloud.hereya.dev/")).toBe(true);
  });

  it("throws HereyaCloudError with status and body on 403", async () => {
    mockFetchOnce({ status: 403, body: "workspace not in consent set" });

    await expect(mintWorkspaceToken("u-tok", "ws_1")).rejects.toMatchObject({
      name: "HereyaCloudError",
      status: 403,
      body: "workspace not in consent set",
    });
  });
});
