// Tiny fetch wrapper around the hereya-cloud user-facing API.
//
// Both endpoints are bearer-authenticated with the user-level OAuth access
// token (kind: "user", RS256) that the agent obtained when the user
// connected this MCP server. The agent forwards that bearer through every
// MCP request; tool handlers extract it from authInfo.token and pass it in
// here verbatim.

export interface Workspace {
  id: string;
  name: string;
  orgId: string;
  orgName: string;
  markedForDeployment: boolean;
}

export interface ListWorkspacesResponse {
  workspaces: Workspace[];
}

export interface MintWorkspaceTokenResponse {
  token: string;
  expires_at: string;
  workspace?: Workspace;
}

const DEFAULT_BASE = "https://cloud.hereya.dev";

function getBaseUrl(): string {
  return (process.env.HEREYA_CLOUD_API_URL || DEFAULT_BASE).replace(/\/+$/, "");
}

export class HereyaCloudError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string, message?: string) {
    super(message ?? `hereya-cloud responded ${status}: ${body}`);
    this.name = "HereyaCloudError";
    this.status = status;
    this.body = body;
  }
}

async function readBody(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

export async function listMyWorkspaces(
  token: string
): Promise<ListWorkspacesResponse> {
  const url = `${getBaseUrl()}/api/workspaces/me`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
    },
  });

  const body = await readBody(res);
  if (!res.ok) {
    throw new HereyaCloudError(res.status, body);
  }

  try {
    return JSON.parse(body) as ListWorkspacesResponse;
  } catch (err) {
    throw new HereyaCloudError(
      res.status,
      body,
      `hereya-cloud returned non-JSON response from ${url}`
    );
  }
}

export async function mintWorkspaceToken(
  token: string,
  workspaceId: string
): Promise<MintWorkspaceTokenResponse> {
  const url = `${getBaseUrl()}/api/tokens/workspace`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ workspace_id: workspaceId }),
  });

  const body = await readBody(res);
  if (!res.ok) {
    throw new HereyaCloudError(res.status, body);
  }

  try {
    return JSON.parse(body) as MintWorkspaceTokenResponse;
  } catch (err) {
    throw new HereyaCloudError(
      res.status,
      body,
      `hereya-cloud returned non-JSON response from ${url}`
    );
  }
}
