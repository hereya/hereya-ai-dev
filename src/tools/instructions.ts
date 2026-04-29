import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadPromptText } from "../prompts/index.js";

interface TopicDef {
  slug: string;
  title: string;
  summary: string;
  filename: string;
}

const TOPICS: TopicDef[] = [
  {
    slug: "create-app",
    title: "Create a Hereya app",
    summary:
      "Scaffold a new Hereya app from a GitHub source template. Step-by-step: pick a default workspace and a deploy workspace, mint a token, run the canonical `npx hereya init` command.",
    filename: "create-app.md",
  },
  {
    slug: "develop-app",
    title: "Develop a Hereya app",
    summary:
      "Provision development infrastructure with `npx hereya up` and run the dev loop with `npx hereya run -- dev start`. Mint a fresh workspace token immediately before each CLI command.",
    filename: "develop-app.md",
  },
  {
    slug: "deploy-app",
    title: "Deploy a Hereya app",
    summary:
      "Mint a token for a deploy workspace, run `npx hereya deploy`, then commit and push. Includes how to react to non-deploy-workspace validation errors.",
    filename: "deploy-app.md",
  },
  {
    slug: "git-workflow",
    title: "Git workflow for Hereya projects",
    summary:
      "How `npx hereya init -t hereya/github-private-repo` wires a git credential helper so normal `git add/commit/push` works with no extra setup.",
    filename: "git-workflow.md",
  },
];

const KNOWN_SLUGS = TOPICS.map((t) => t.slug).join(", ");

export function registerGetInstructionsTool(server: McpServer) {
  server.registerTool(
    "get_instructions",
    {
      title: "Get Hereya CLI workflow instructions",
      description:
        "Returns step-by-step Hereya workflow instructions for AI agents. " +
        "**Call this immediately after the user asks to create, develop, or deploy a Hereya app** — " +
        "it returns the canonical CLI commands and explains how to use the other tools in this server. " +
        "Always call this before invoking any `npx hereya …` command if you are not 100% sure of the exact " +
        "flag layout — the instructions are the single source of truth.\n\n" +
        "Inputs:\n" +
        "  - `topic` (optional): one of `create-app`, `develop-app`, `deploy-app`, `git-workflow`. " +
        "When omitted, returns the catalog of available topics with one-line summaries; " +
        "call this tool again with `topic` set to the slug you need to retrieve the full guide.\n\n" +
        "Recommended sequence on first interaction with this MCP server:\n" +
        "  1. Call `get_instructions` (no arguments) to see the catalog.\n" +
        "  2. Call `get_instructions` with the topic that matches the user's intent.\n" +
        "  3. Follow the steps in the returned markdown, using `list_authorized_workspaces` and " +
        "`mint_workspace_token` as the markdown directs.",
      inputSchema: {
        topic: z
          .string()
          .optional()
          .describe(
            `Optional workflow slug. One of: ${KNOWN_SLUGS}. Omit to get the catalog.`
          ),
      },
    },
    async ({ topic }) => {
      // Catalog mode.
      if (!topic) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                topics: TOPICS.map((t) => ({
                  slug: t.slug,
                  title: t.title,
                  summary: t.summary,
                })),
                next: "Call get_instructions again with `topic` set to one of the slugs above to retrieve the full markdown guide.",
              }),
            },
          ],
        };
      }

      // Topic mode.
      const match = TOPICS.find((t) => t.slug === topic);
      if (!match) {
        return {
          isError: true as const,
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: {
                  code: "UNKNOWN_TOPIC",
                  message: `Unknown topic '${topic}'. Available topics: ${KNOWN_SLUGS}.`,
                },
              }),
            },
          ],
        };
      }

      try {
        const markdown = loadPromptText(match.filename);
        return {
          content: [
            {
              type: "text" as const,
              text: markdown,
            },
          ],
        };
      } catch (err) {
        return {
          isError: true as const,
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: {
                  code: "INSTRUCTIONS_LOAD_ERROR",
                  message: (err as Error).message ?? String(err),
                },
              }),
            },
          ],
        };
      }
    }
  );
}
