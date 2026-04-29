# Create a new Hereya app

Use this flow when the user asks to create / scaffold / start a new Hereya app.

## 1. Gather inputs from the user

Ask the user for:

- **App slug** in `org/repo` form (e.g. `acme/orders`). The `org` is a Hereya organization the user belongs to; `repo` is the GitHub repo the template will create.
- **Source template** in `<github-org>/<repo>` form (e.g. `hereya/lambda-mcp-starter`). This is the upstream starter the new repo will be cloned from. It is passed to `hereya init` as `--parameter sourceTemplate=<sourceTemplate>`.
- **Default workspace** — the workspace where development infrastructure will live (the `-w` flag for `hereya init` and `hereya up`). Pick from workspaces with `markedForDeployment=false`.
- **Deploy workspace** — the workspace where the app will eventually be deployed (the `--deploy-workspace` flag for `hereya init` and the `-w` flag for `hereya deploy`). Pick from workspaces with `markedForDeployment=true`.

## 2. Discover workspaces

Call `list_authorized_workspaces`.

- For the default-workspace question, present only entries where `markedForDeployment === false`. If none exist, tell the user — they must reconnect this MCP server and include a development workspace in the consent screen.
- For the deploy-workspace question, present only entries where `markedForDeployment === true`. Same fallback if none exist.

Use the fully qualified `orgName/name` form when passing a workspace to the CLI (it's unambiguous when the user has access to multiple orgs). Use the workspace `id` when calling other MCP tools.

## 3. Mint the init token

`hereya init` runs against the **default** workspace, so:

```
mint_workspace_token({ workspace_id: <default workspace id> })
```

Capture the returned `token` — you will pass it as `--token <token>` to the CLI command in step 4. Do not reuse this token for later commands; mint a fresh one for each `hereya …` invocation.

## 4. Run `hereya init`

```
npx -y hereya-cli init <org>/<app> \
  --deploy-workspace <deploy-ws> \
  -w <default-ws> \
  --template hereya/github-private-repo \
  --parameter sourceTemplate=<sourceTemplate> \
  --token <minted-token>
```

Substitutions:

- `<org>/<app>` — the app slug from step 1.
- `<deploy-ws>` — the deploy workspace in `orgName/name` form.
- `<default-ws>` — the default workspace in `orgName/name` form.
- `<sourceTemplate>` — the source template from step 1.
- `<minted-token>` — the token from step 3.

Run the command from the directory where the user wants the project to be scaffolded. After it succeeds:

- The project is now on disk under `./<app>/`.
- The git remote (`origin`) is already configured to the new private repo created from `hereya/github-private-repo`.
- The git credential helper is wired automatically by the template — the user can `git push` immediately, with no extra setup.

## 5. Hand off

Offer to walk the user through the dev loop next — see the `develop-app` prompt: provision dev infrastructure with `hereya up` and start the dev process with `hereya run -- dev start`.
