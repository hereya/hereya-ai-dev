# hereya-ai-dev

Remote MCP server (deployed on AWS Lambda via `hereya/aws-user-mcp-lambda`) that lets an AI agent operate Hereya on behalf of a connected user. The user authenticates via OAuth at `https://cloud.hereya.dev`; the agent then calls MCP tools to (a) list the workspaces the user consented to and (b) mint short-lived workspace-scoped Hereya CLI tokens. The agent runs `npx -y hereya-cli …` commands with `--token <minted-token>` to drive Hereya itself.

## Quick commands

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run build       # copy prompts → dist/prompts/, esbuild handler → dist/handler.js
```

## Layout

| Path | Role |
|---|---|
| `src/handler.ts` | Lambda entry. Wraps the API Gateway event in a Web `Request`, builds `authInfo` from the bearer + authorizer context, hands off to `WebStandardStreamableHTTPServerTransport`. |
| `src/server.ts` | `createServer()` — `McpServer` factory. Registers tools and prompts. |
| `src/hereya-client.ts` | Tiny fetch wrapper around `GET /api/workspaces/me` and `POST /api/tokens/workspace`. Reads `HEREYA_CLOUD_API_URL` (defaults to `https://cloud.hereya.dev`). Throws `HereyaCloudError(status, body)` on non-2xx. |
| `src/tools/workspaces.ts` | `list_authorized_workspaces` tool. |
| `src/tools/token.ts` | `mint_workspace_token` tool. |
| `src/tools/index.ts` | Wires both tools into the server. |
| `src/prompts/*.md` | One markdown file per prompt (`create-app`, `develop-app`, `deploy-app`, `git-workflow`). |
| `src/prompts/index.ts` | Loads each `.md` from `dist/prompts/` at runtime and registers as MCP prompts. |
| `scripts/copy-prompts.js` | Build step — copies `src/prompts/*.md` → `dist/prompts/*.md`. |
| `hereya.yaml` | Declares the `hereya/aws-user-mcp-lambda` deploy package. |
| `hereyarc.yaml` | `kind: app` registry manifest. Parameters: `customDomain`, `oauthServerUrl`, `hereyaCloudApiUrl`, `lambdaTimeout`. |
| `hereyaconfig/hereyavars/hereya--aws-user-mcp-lambda.yaml` | Substitutes the parameters into the deploy package. |

## Adding a new tool

1. Create `src/tools/<name>.ts`, exporting `register<Name>Tool(server: McpServer)`.
2. Use `server.registerTool(name, { title, description, inputSchema }, handler)` with a Zod-shaped `inputSchema`.
3. Pull the bearer from `authInfo.token` (second handler arg). Forward to a `hereya-client.ts` helper.
4. Surface non-2xx responses verbatim — return `{ isError: true, content: [{ type: "text", text: JSON.stringify({ error: { code, message } }) }] }`.
5. Register the tool in `src/tools/index.ts`.

## Adding a new prompt

1. Add `src/prompts/<name>.md`.
2. Add an entry to the `PROMPTS` array in `src/prompts/index.ts`.
3. Re-run `npm run build:prompts` (or `npm run build`) so the file is copied into `dist/prompts/`.

## Auth model

Two tiers of token, both minted by `hereya-cloud`:

1. **User-level OAuth access token** (kind: `user`, RS256). Issued by `https://cloud.hereya.dev/oauth/{authorize,token,register}`. Travels in the bearer of every MCP request and authenticates the tool calls in this server.
2. **Workspace-scoped CLI token** (kind: `cli`, capped at 1 hour by the server). Minted via `mint_workspace_token`. The agent passes it to `npx -y hereya-cli … --token <…>` invocations. There is no refresh — when it expires, mint another.

The set of workspaces the user consented to is enforced by `/api/workspaces/me` (returns only consented workspaces) and `/api/tokens/workspace` (403s on non-consented `workspace_id`). To change the set, the user disconnects and reconnects this MCP server.

## Deployment

Bump `version:` in `hereyarc.yaml`, commit, push, then:

```bash
hereya publish
hereya app deploy hereya/ai-dev \
  -w hereya/<workspace> \
  -p customDomain=ai-dev.hereyalab.dev
```

The build (`npm install && npm run build`) runs on the executor at deploy time via `preDeployCommand` — no need to build locally before publishing.

## Tests

There are no unit tests yet. Tool handlers can be smoke-tested manually with the MCP inspector; the cloud endpoints (`/api/workspaces/me`, `/api/tokens/workspace`) have their own coverage in `hereya-cloud/`.
