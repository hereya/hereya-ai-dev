# Deploy a Hereya app

Use this flow when the user wants to deploy a Hereya app from their local checkout.

## 1. Identify the deploy workspace

Deployment runs against a workspace marked for deployment. To find one, call `list_authorized_workspaces` and present only entries with `markedForDeployment === true`. If none exist, the user did not authorize a deploy workspace during OAuth — tell them to disconnect and reconnect this MCP server and include a deploy workspace in the consent set.

The deploy workspace is also recorded in the project's `hereya.yaml` (set via `--deployWorkspace` at `hereya init` time). Confirm with the user that they want to deploy to that workspace, or pick another from the list.

## 2. Mint a token for the deploy workspace

```
mint_workspace_token({ workspace_id: <deploy workspace id> })
```

Mint immediately before the deploy command — tokens last at most 1 hour.

## 3. Run `hereya deploy`

From the project directory:

```
npx hereya deploy -w <deploy-workspace> --token <minted-token>
```

Substitutions:

- `<deploy-workspace>` — the deploy workspace chosen in step 1, in `orgName/name` form.
- `<minted-token>` — the token from step 2.

The CLI validates that the target workspace is a deploy workspace. **A non-deploy workspace will return an error.** If you see that error:

1. Re-call `list_authorized_workspaces`.
2. Filter for `markedForDeployment === true`.
3. Confirm the user picked one from that filtered list.
4. Re-mint a token for the corrected workspace and retry.

## 4. Commit and push

After `hereya deploy` succeeds, walk the user through committing and pushing the project:

```
git add -A
git commit -m "Deploy"
git push
```

The git credential helper was wired automatically when the project was scaffolded with `hereya init -t hereya/github-private-repo`, so `git push` works without any extra credential setup. If push fails with an authentication error, see the `git-workflow` prompt for troubleshooting.

## 5. Iterate

Subsequent deploys repeat steps 2–4. Always mint a fresh token immediately before each `hereya deploy` invocation — never reuse a token from a previous deploy.
