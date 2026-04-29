import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as fs from "node:fs";
import * as path from "node:path";

interface PromptDef {
  name: string;
  title: string;
  description: string;
  filename: string;
}

const PROMPTS: PromptDef[] = [
  {
    name: "create-app",
    title: "Create a Hereya app",
    description:
      "Walk the user through scaffolding a new Hereya app: pick a default and deploy workspace, then run `hereya init` against the right template with a freshly-minted workspace token.",
    filename: "create-app.md",
  },
  {
    name: "develop-app",
    title: "Develop a Hereya app",
    description:
      "Provision development infrastructure with `hereya up` and run the dev loop with `hereya run -- dev start`. Mint a fresh workspace token immediately before each CLI command.",
    filename: "develop-app.md",
  },
  {
    name: "deploy-app",
    title: "Deploy a Hereya app",
    description:
      "Mint a token for the deploy workspace, run `hereya deploy`, then walk the user through `git push`. Reject non-deploy workspaces by re-listing and re-confirming.",
    filename: "deploy-app.md",
  },
  {
    name: "git-workflow",
    title: "Git workflow for Hereya projects",
    description:
      "How `hereya init -t hereya/github-private-repo` wires a git credential helper so normal `git add/commit/push` works with no extra setup. This MCP server provides no git tooling.",
    filename: "git-workflow.md",
  },
];

function loadPromptText(filename: string): string {
  // Prompts are copied into <build-output>/prompts/*.md by scripts/copy-prompts.js.
  // After esbuild bundles src/handler.ts → dist/handler.js, __dirname at runtime
  // is the directory containing handler.js (i.e. dist/). The prompts/ subfolder
  // lives next to it.
  //
  // In tests we run the .ts files directly, so __dirname is src/prompts/ — the
  // prompt files sit alongside this loader. Try the bundled layout first, then
  // fall back to the source layout.
  const bundledPath = path.join(__dirname, "prompts", filename);
  if (fs.existsSync(bundledPath)) {
    return fs.readFileSync(bundledPath, "utf-8");
  }
  const sourcePath = path.join(__dirname, filename);
  return fs.readFileSync(sourcePath, "utf-8");
}

export function registerPrompts(server: McpServer) {
  for (const prompt of PROMPTS) {
    const text = loadPromptText(prompt.filename);
    server.registerPrompt(
      prompt.name,
      {
        title: prompt.title,
        description: prompt.description,
      },
      () => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text,
            },
          },
        ],
      })
    );
  }
}
