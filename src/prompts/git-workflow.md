# Git workflow for Hereya projects

Hereya projects scaffolded with `hereya init -t hereya/github-private-repo` come with git already configured — the agent does **not** need to run any extra git setup commands.

## What `hereya init` does

When the project is scaffolded:

1. A new private GitHub repo is created on the user's behalf via the Hereya GitHub app installation.
2. The local checkout has its `origin` remote pointed at that new repo.
3. A git credential helper is wired into the local repo configuration so that `git push` and `git fetch` over HTTPS resolve credentials without prompting:

   ```
   git config credential.helper '!npx -y hereya-cli credential-helper'
   ```

The credential helper resolves a short-lived GitHub access token from the project metadata each time git asks for credentials. The user does **not** need a personal GitHub token, SSH key, or `gh auth login` to push.

## Day-to-day usage with `--token`

Because this MCP server brokers ephemeral tokens (no `hereya login` on the user's machine), every git operation that needs cloud auth — `push`, `pull`, `fetch` — must run through the **`hereya git` wrapper** so the credential helper sees the token.

Pattern: mint a workspace-scoped token, then run git through the wrapper, separating hereya flags from git's own with `--`:

```
mint_workspace_token({ workspace_id: <default workspace id> })
```

Then:

```
npx -y hereya-cli git --token <minted-token> --chdir <project-dir> -- push
npx -y hereya-cli git --token <minted-token> --chdir <project-dir> -- pull --rebase
npx -y hereya-cli git --token <minted-token> --chdir <project-dir> -- fetch origin
```

Notes:

- `--token` is propagated to the credential-helper grandchild via the `HEREYA_EPHEMERAL_TOKEN` env var. This is the only mechanism that makes auth work in MCP-driven flows; plain `git push` will fail with a credential prompt because the helper has no ambient token.
- `--chdir` sets the cwd of the spawned git. Optional if the agent's shell is already in the project directory.
- The `--` separator is **required** when git's own arguments include flags (`--rebase`, `-u`, `--depth=1`, etc.). Without it, oclif tries to parse them as hereya flags and rejects them.
- Mint a fresh token immediately before each git invocation — tokens last at most 1 hour.
- `git add` and `git commit` do **not** need the wrapper or a token (they don't talk to any remote). The agent can use its environment-native git tools for those:
  ```
  git add -A
  git commit -m "..."
  ```

## `hereya git clone` for fresh checkouts

When the user wants to pull down an existing Hereya project from GitHub on a new machine (no `hereya init` involved), use:

```
npx -y hereya-cli git --token <minted-token> -- clone <repo-url> [<target-dir>]
```

After a successful clone, the wrapper auto-wires the cloned repo to use the hereya credential helper, so subsequent `push`/`pull`/`fetch` from inside that directory work the same way as a freshly-init'd project (still via the wrapper with `--token`).

## Troubleshooting

If `git push` fails with an authentication error:

- Confirm the agent used the wrapper: `npx -y hereya-cli git --token <…> -- push` (NOT plain `git push`).
- Confirm the token is fresh — re-mint via `mint_workspace_token` and retry.
- Confirm the credential helper is configured in the local repo: `git -C <project> config --get-all credential.helper` should include `hereya-cli credential-helper`. If it's missing, re-init the project or run `npx -y hereya-cli git --chdir <project> -- clone <url>` into a fresh dir.

## When NOT to use this server's tools

This MCP server's tools (`list_authorized_workspaces`, `mint_workspace_token`, `get_instructions`) are about workspace-scoped Hereya auth — not git semantics. Do not call them from a pure git workflow that doesn't touch a Hereya remote.
