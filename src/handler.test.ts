import { beforeAll, describe, expect, it } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

const OAUTH_SERVER_URL = "https://cloud.example.test";
const MCP_RESOURCE_URL = "https://ai-dev.example.test/mcp";

beforeAll(() => {
  process.env.OAUTH_SERVER_URL = OAUTH_SERVER_URL;
  process.env.MCP_RESOURCE_URL = MCP_RESOURCE_URL;
});

function makeEvent(
  method: string,
  path: string,
  headers: Record<string, string> = {}
): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: "",
    headers,
    requestContext: {
      accountId: "0",
      apiId: "x",
      domainName: "ai-dev.example.test",
      domainPrefix: "ai-dev",
      http: {
        method,
        path,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "vitest",
      },
      requestId: "r",
      routeKey: `${method} ${path}`,
      stage: "$default",
      time: "now",
      timeEpoch: 0,
    },
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEventV2;
}

describe("handler routing", () => {
  it("serves /.well-known/oauth-protected-resource with the expected JSON", async () => {
    const { handler } = await import("./handler.js");
    const res = await handler(
      makeEvent("GET", "/.well-known/oauth-protected-resource")
    );

    expect(res.statusCode).toBe(200);
    expect(res.headers?.["content-type"]).toBe("application/json");

    const body = JSON.parse((res.body as string) ?? "{}");
    expect(body).toMatchObject({
      resource: MCP_RESOURCE_URL,
      authorization_servers: [OAUTH_SERVER_URL],
      bearer_methods_supported: ["header"],
      scopes_supported: ["mcp:access"],
    });
  });

  it("redirects /.well-known/oauth-authorization-server upstream", async () => {
    const { handler } = await import("./handler.js");
    const res = await handler(
      makeEvent("GET", "/.well-known/oauth-authorization-server")
    );

    expect(res.statusCode).toBe(302);
    expect(res.headers?.location).toBe(
      `${OAUTH_SERVER_URL}/.well-known/oauth-authorization-server`
    );
  });

  it("returns 401 with WWW-Authenticate when /mcp has no bearer", async () => {
    const { handler } = await import("./handler.js");
    const res = await handler(makeEvent("POST", "/mcp"));

    expect(res.statusCode).toBe(401);
    const wwwAuth =
      res.headers?.["WWW-Authenticate"] ?? res.headers?.["www-authenticate"];
    expect(typeof wwwAuth).toBe("string");
    expect(wwwAuth as string).toContain("Bearer");
    expect(wwwAuth as string).toContain(
      `resource_metadata="${MCP_RESOURCE_URL}/.well-known/oauth-protected-resource"`
    );
    expect(res.headers?.["access-control-expose-headers"]).toContain(
      "WWW-Authenticate"
    );
  });

  it("returns 204 for OPTIONS preflight", async () => {
    const { handler } = await import("./handler.js");
    const res = await handler(makeEvent("OPTIONS", "/mcp"));
    expect(res.statusCode).toBe(204);
  });

  it("returns 404 for unknown routes", async () => {
    const { handler } = await import("./handler.js");
    const res = await handler(makeEvent("GET", "/something-else"));
    expect(res.statusCode).toBe(404);
  });
});
