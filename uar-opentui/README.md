# UAR OpenTUI

An OpenCode-inspired terminal client for the Universal Agent Runtime.

## Architecture

- `apps/tui`: SolidJS + `@opentui/solid` terminal UI
- `crates/uar-protocol`: shared JSON-lines wire protocol
- `crates/uar-runtime`: Rust runtime process and streaming demo agent

The TUI is a presentation client. The Rust process owns execution, permissions, sessions, tools, and future MCP/A2A/plugin integrations.

## Run

Requirements: Bun 1.2+, Rust stable.

```bash
cargo build -p uar-runtime
bun install
bun run dev
```

The TUI launches `target/debug/uar-runtime` automatically. Override it with:

```bash
UAR_RUNTIME_BIN=/path/to/uar-runtime bun run dev
```

## Implemented

- OpenTUI/Solid application shell
- OpenCode-style transcript and prompt composer
- JSON-lines IPC over child-process stdio
- typed runtime events and UI commands
- streaming assistant responses
- slash-command handling foundation
- graceful cancellation and shutdown
- Rust protocol tests and CI

## Next production milestones

1. Replace the demo responder with UAR agent/model adapters.
2. Add tool cards, permission dialogs, diffs, file search, and session persistence.
3. Add exact OpenCode keymap/theme compatibility and golden terminal snapshots.
4. Embed the TUI assets and runtime into release binaries.
