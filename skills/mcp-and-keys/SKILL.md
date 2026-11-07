---
name: mcp-and-keys
description: Use when asked to add, remove, or change an MCP server, model, provider, or API connection, or when any task touches API keys — registry-first workflow, keys by env-var reference only, never read or print key values.
---

# MCP and keys (ADR-0017)

uika 0.1.0 bundles no `models` or `mcp` renderer (see `docs/roadmap.md`): the registries are the
source of truth and each harness config is written from them by hand. `uika deploy` reports a
registry change as render-only and never writes harness configs.

## Change a model or provider
1. Edit `providers/registry.json` (provider `keyEnv` = variable **name**; model alias, id, roles).
2. Write the matching entry into each harness's config by hand (or hand the snippet to the owner).
3. Confirm the key variables are set without printing them (check presence, never the value).

## Change an MCP server
1. Edit `mcp/servers.json` (`secretEnv` = names only; `harnesses` = where it applies).
2. Write the server into each listed harness's native config. Avoid duplicating a server across nested homes (Gemini + Antigravity).

## Hard rules
- **Never** read, print, log, or write a key value. Do not open `.env`, `opencode.jsonc` provider blocks, credential stores, or `claude_desktop_config.json` env sections.
- Registries hold only variable names; `uika lint` warns on secret-shaped values.
- Rotating a key: the **owner** sets the user environment variable once and restarts the harness. Agents ask; they don't set it.
- If a config already holds a plaintext key (for example an opencode provider block), don't copy it: propose migrating it to `{env:PROVIDER_API_KEY}` and tell the owner to rotate.

## Desktop apps
Claude Desktop: `mcpServers` JSON in `claude_desktop_config.json`. Codex Desktop shares `~/.codex/config.toml`. OpenCode Desktop shares the CLI config (`~/.config/opencode/opencode.jsonc`) — no separate desktop file.

## Toolchain
MCP servers launch through `npx` or `uvx`; pin the version in the registry entry. Dependencies belong in the server's own manifest, never in a key file. See skills/toolchains.
