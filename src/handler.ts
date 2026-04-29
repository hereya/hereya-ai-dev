import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { createServer } from "./server.js";

// -----------------------------------------------------------------------
// Env
// -----------------------------------------------------------------------

function getOAuthServerUrl(): string {
  const url = process.env.OAUTH_SERVER_URL;
  if (!url) throw new Error("OAUTH_SERVER_URL is required");
  return url.replace(/\/+$/, "");
}

function getMcpResourceUrl(): string {
  const url = process.env.MCP_RESOURCE_URL;
  if (!url) throw new Error("MCP_RESOURCE_URL is required");
  return url.replace(/\/+$/, "");
}

// -----------------------------------------------------------------------
// JWKS (cached across warm invocations)
// -----------------------------------------------------------------------

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksFor: string | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  const issuer = getOAuthServerUrl();
  if (jwks && jwksFor === issuer) return jwks;
  jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  jwksFor = issuer;
  return jwks;
}

// -----------------------------------------------------------------------
// Response helpers
// -----------------------------------------------------------------------

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-expose-headers": "WWW-Authenticate",
};

function unauthorized(
  message: string
): APIGatewayProxyStructuredResultV2 {
  const resourceUrl = getMcpResourceUrl();
  // RFC 9728 / MCP authorization spec: point clients at the
  // protected-resource metadata so they can discover the OAuth issuer.
  const wwwAuth =
    `Bearer realm="hereya-ai-dev", ` +
    `resource_metadata="${resourceUrl}/.well-known/oauth-protected-resource"`;

  return {
    statusCode: 401,
    headers: {
      ...CORS_HEADERS,
      "content-type": "application/json",
      "WWW-Authenticate": wwwAuth,
    },
    body: JSON.stringify({
      error: { code: "unauthorized", message },
    }),
  };
}

function notFound(): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: 404,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
    body: JSON.stringify({ error: { code: "not_found", message: "not found" } }),
  };
}

function noContent(): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: 204,
    headers: CORS_HEADERS,
    body: "",
  };
}

function protectedResourceMetadata(): APIGatewayProxyStructuredResultV2 {
  const resource = getMcpResourceUrl();
  const issuer = getOAuthServerUrl();
  return {
    statusCode: 200,
    headers: {
      ...CORS_HEADERS,
      "content-type": "application/json",
      "cache-control": "public, max-age=300",
    },
    body: JSON.stringify({
      resource,
      authorization_servers: [issuer],
      bearer_methods_supported: ["header"],
      scopes_supported: ["mcp:access"],
    }),
  };
}

function authorizationServerRedirect(): APIGatewayProxyStructuredResultV2 {
  const issuer = getOAuthServerUrl();
  return {
    statusCode: 302,
    headers: {
      ...CORS_HEADERS,
      location: `${issuer}/.well-known/oauth-authorization-server`,
      "cache-control": "public, max-age=300",
    },
    body: "",
  };
}

// -----------------------------------------------------------------------
// Bearer verification
// -----------------------------------------------------------------------

interface VerifiedToken {
  token: string;
  payload: JWTPayload & {
    kind?: string;
    user_id?: string;
    workspace_ids?: string[];
  };
}

async function verifyBearer(
  authHeader: string | undefined
): Promise<VerifiedToken | null> {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      // Tolerate small clock skew between cloud and Lambda.
      clockTolerance: 30,
    });
    if (payload.kind !== "user") return null;
    return { token, payload: payload as VerifiedToken["payload"] };
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------
// MCP transport
// -----------------------------------------------------------------------

async function handleMcpPost(
  event: APIGatewayProxyEventV2,
  verified: VerifiedToken
): Promise<APIGatewayProxyStructuredResultV2> {
  const server = createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);

  try {
    const url = `https://${event.requestContext.domainName}${event.rawPath}${
      event.rawQueryString ? "?" + event.rawQueryString : ""
    }`;
    const body = event.isBase64Encoded
      ? Buffer.from(event.body ?? "", "base64").toString()
      : event.body ?? "";

    const request = new Request(url, {
      method: "POST",
      headers: new Headers(event.headers as Record<string, string>),
      body,
    });

    let parsedBody: unknown;
    try {
      parsedBody = body ? JSON.parse(body) : undefined;
    } catch {
      parsedBody = undefined;
    }

    const userId = String(
      verified.payload.user_id ?? verified.payload.sub ?? ""
    );

    const authInfo = {
      token: verified.token,
      clientId: "api-gateway",
      scopes: ["mcp:access"],
      extra: {
        userId,
      },
    };

    const response = await transport.handleRequest(request, {
      parsedBody,
      authInfo,
    });

    const responseBody = await response.text();
    const responseHeaders: Record<string, string> = { ...CORS_HEADERS };
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: responseBody,
    };
  } finally {
    await transport.close();
    await server.close();
  }
}

// -----------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  const method = event.requestContext?.http?.method ?? "GET";
  const path = event.rawPath ?? "/";

  // Defensive OPTIONS — API Gateway's CORS preflight should normally
  // intercept these, but answer in-Lambda just in case.
  if (method === "OPTIONS") {
    return noContent();
  }

  if (method === "GET" && path === "/.well-known/oauth-protected-resource") {
    return protectedResourceMetadata();
  }

  if (method === "GET" && path === "/.well-known/oauth-authorization-server") {
    return authorizationServerRedirect();
  }

  if (method === "POST" && path === "/mcp") {
    const authHeader =
      event.headers?.authorization ?? event.headers?.Authorization;
    const verified = await verifyBearer(authHeader);
    if (!verified) {
      return unauthorized(
        authHeader
          ? "Invalid or expired bearer token"
          : "Missing Authorization: Bearer <token>"
      );
    }
    return handleMcpPost(event, verified);
  }

  return notFound();
};
