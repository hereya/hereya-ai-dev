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

   (The exact form is set by `hereya init`; you can confirm with `git -C <project> config --get-all credential.helper`.)

The credential helper resolves a short-lived GitHub access token from the project metadata each time git asks for credentials. The user does **not** need a personal GitHub token, SSH key, or `gh auth login` to push.

## Day-to-day usage

Inside the scaffolded project, normal git commands just work — use whatever git tools your environment provides (the host's git CLI, an IDE git pane, etc.):

```
git status
git add -A
git commit -m "..."
git push
git pull
```

This MCP server provides **no git tooling** — there are no MCP tools for `add`, `commit`, `push`, etc. Use the agent's environment-native git tools.

## Troubleshooting

If `git push` fails with an authentication error:

- Verify the credential helper is configured: `git -C <project> config --get-all credential.helper` should include an `npx -y hereya-cli credential-helper` entry.
- If it's missing, the project may have been created outside the `hereya/github-private-repo` template. The user can re-wire it manually with the command shown above, or re-init the project.
- The credential helper depends on `npx` being available on PATH and on the local Hereya CLI cache having the project's metadata. If the user moved or copied the directory across machines, ask them to run `npx -y hereya-cli state list` once in the project directory to repopulate the cache.

## When NOT to use this server's tools

This MCP server's only tools are `list_authorized_workspaces` and `mint_workspace_token`. They have nothing to do with git itself. Do not call them from a pure git workflow.
