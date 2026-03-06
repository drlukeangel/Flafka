# Documentation

Flink SQL Workspace UI — a browser-based SQL editor for Confluent Cloud Flink. This folder contains all project documentation for contributors and maintainers.

## Start Here

If you are new to the project, read these in order:

1. [Project README](../README.md) — Setup, install, and run the dev server
2. [Architecture](TECH-STACK.md) — Stack, architecture diagram, APIs, state management, and environment config
3. Root [CLAUDE.md](../CLAUDE.md) — Development commands and key file locations

## Reference

| Document | What it covers |
|----------|---------------|
| [Tech Stack & Architecture](TECH-STACK.md) | Stack table, architecture layers, all 6 Confluent APIs, state management, proxy config, env vars |
| [Feature Reference](FEATURES.md) | Every shipped feature grouped by component |
| [Testing Guide](TESTING-GUIDE.md) | How to run tests, write tests, test tiers, markers, API validation checklist |
| [Roadmap](ROADMAP.md) | Current feature in progress, upcoming releases, backlog |

## Workflow (AI Agents)

The `docs/agents/` directory contains AI agent definitions used during the automated development pipeline. These are **not required reading** for contributors — they drive the CI/CD orchestration process, not day-to-day development.
