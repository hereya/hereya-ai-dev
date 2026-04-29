# Develop a Hereya app locally

Use this flow when the user wants to provision development infrastructure and start the dev loop on an already-scaffolded Hereya project.

## 1. Identify the default workspace

The default (development) workspace is the one passed via `-w` at `hereya init` time and recorded in the project's `hereya.yaml`. If the user is unsure, call `list_authorized_workspaces` and present workspaces with `markedForDeployment=false`.

## 2. Mint a token for the default workspace

```
mint_workspace_token({ workspace_id: <default workspace id> })
```

Mint **immediately before** the next CLI command. Tokens last at most 1 hour and there is no refresh — when they expire, mint another and retry.

## 3. Provision dev infrastructure

From the project directory:

```
npx hereya up --token <minted-token>
```

This applies the infrastructure declared in `hereya.yaml` (databases, queues, secrets, etc.) into the default workspace. The command can be long-running (minutes).

## 4. Run the dev process

```
npx hereya run --token <minted-token> -- dev start
```

`--token` is an oclif top-level flag on `run` and **must** appear before `--`. The `--` separates oclif's own arguments from the user-defined dev command — anything after `--` is forwarded to the script invoked by `hereya run`. For starter templates, `dev start` typically launches the app with hot-reload. Mint a fresh token for this command — do not reuse the one from `hereya up`.

## 5. Iterate

Each time you call a `hereya` CLI command, mint a fresh token first. Pattern:

```
mint_workspace_token → npx hereya … --token <token>
```

If a CLI command fails with an authentication / expired-token error, the token TTL elapsed mid-command. Mint a new token and retry.

For long-running operations like `hereya up`, expect the command itself to finish within an hour. If you anticipate it approaching the limit, your responsibility is to plan around the next mint at the boundary between commands — never refresh mid-command.

## 6. Common follow-ups

- **Add a package**: edit `hereya.yaml`, then re-run `npx hereya up --token <fresh-token>`.
- **Tear down dev infra**: `npx hereya down --token <fresh-token>` (workspace-scoped — only affects the default workspace).
- **Inspect state**: `npx hereya state list --token <fresh-token>`.

When the user is ready to ship, switch to the `deploy-app` flow.
