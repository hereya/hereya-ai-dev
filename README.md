# hereya-ai-dev

Remote **MCP server** that lets an AI agent operate Hereya on behalf of a connected user. Deployed as an AWS Lambda behind API Gateway via `hereya/aws-user-mcp-lambda`.

## What it does

Two MCP tools and four MCP prompts. The tools are everything the agent needs to drive Hereya from the outside; the prompts walk the agent through the standard create / develop / deploy flow.

### Tools

| Tool | Calls | Purpose |
|---|---|---|
| `list_authorized_workspaces` | `GET /api/workspaces/me` | List Hereya workspaces the user consented to during OAuth. Each carries a `markedForDeployment` flag. |
| `mint_workspace_token` | `POST /api/tokens/workspace` | Mint a short-lived (≤1h) workspace-scoped Hereya CLI token. Pass it to `npx -y hereya-cli … --token <token>`. |

### Prompts

- `create-app` — scaffold a new Hereya app with `hereya init`.
- `develop-app` — provision dev infra (`hereya up`) and run the dev loop (`hereya run -- dev start`).
- `deploy-app` — deploy with `hereya deploy` then `git push`.
- `git-workflow` — how the credential helper wired by `hereya init` makes `git push` work.

## Auth model

```
Browser ──OAuth──▶ cloud.hereya.dev    (user-level access token, RS256, kind:"user")
Agent   ──MCP   ──▶ hereya-ai-dev      (forwards user token in bearer)
                  └──▶ list_authorized_workspaces / mint_workspace_token
                       └──▶ cloud.hereya.dev (same user token)
                            └──▶ returns workspace-scoped CLI token (≤1h)
Agent   ──CLI  ──▶ npx -y hereya-cli … --token <CLI token>
```

The user controls which workspaces are usable by picking them on the OAuth consent screen. Add or remove workspaces by disconnecting and reconnecting this MCP server.

## Local dev

```bash
npm install
npm run typecheck
npm run build       # → dist/handler.js + dist/prompts/*.md
```

The bundled handler is what gets uploaded to Lambda; the prompts are read at runtime from `dist/prompts/`.

## Deployment

Once per release:

```bash
# Bump version in hereyarc.yaml, commit, push.
hereya publish
```

Per workspace:

```bash
hereya app deploy hereya/ai-dev \
  -w hereya/<workspace> \
  -p customDomain=ai-dev.hereyalab.dev
```

Optional parameters (defaults shown):

| Parameter | Default | Use |
|---|---|---|
| `oauthServerUrl` | `https://cloud.hereya.dev` | OAuth issuer the deployed Lambda authenticates against. |
| `hereyaCloudApiUrl` | `https://cloud.hereya.dev` | API base for `/api/workspaces/me` etc. |
| `lambdaTimeout` | `30` | Seconds. Tool handlers only do quick HTTPS calls — 30s is plenty. |

After deploy, register the MCP server in your AI client at `https://<customDomain>/mcp` and run the OAuth dance.

## Project layout

```
hereya-ai-dev/
├── src/
│   ├── handler.ts           # Lambda entry — bearer extraction + MCP transport
│   ├── server.ts            # McpServer factory
│   ├── hereya-client.ts     # fetch wrapper for hereya-cloud
│   ├── tools/
│   │   ├── index.ts
│   │   ├── workspaces.ts    # list_authorized_workspaces
│   │   └── token.ts         # mint_workspace_token
│   └── prompts/
│       ├── index.ts
│       ├── create-app.md
│       ├── develop-app.md
│       ├── deploy-app.md
│       └── git-workflow.md
├── hereya.yaml              # deploy: hereya/aws-user-mcp-lambda
├── hereyarc.yaml            # kind: app — registry manifest
├── hereyaconfig/hereyavars/
│   └── hereya--aws-user-mcp-lambda.yaml
├── scripts/copy-prompts.js  # build step
├── package.json
└── tsconfig.json
```
