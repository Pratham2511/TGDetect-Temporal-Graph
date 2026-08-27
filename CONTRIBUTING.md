# Contributing to TGDetect Frontend

Thanks for your interest in contributing! This document outlines the process.

## Development Workflow

1. **Fork** the repository and create your branch from `main`.
2. **Install** dependencies:
   ```bash
   bun install
   ```
3. **Develop** — make your changes. The frontend is organized into 8 page sections under `src/components/tgdetect/`, with shared types and services under `src/lib/tgdetect/`.
4. **Lint** — make sure your code passes ESLint:
   ```bash
   bun run lint
   ```
5. **Build** — verify the production build succeeds:
   ```bash
   bun run build
   ```
6. **Commit** — use clear, conventional commit messages (e.g., `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).
7. **Open a Pull Request** describing your changes.

## Architecture Principles

When contributing, please respect these architectural principles:

- **Backend contract is source of truth.** All TypeScript domain types in `src/lib/tgdetect/types.ts` must mirror the actual Python backend schemas in [dhruvmankame/tgdetect](https://github.com/dhruvmankame/tgdetect). Do not invent fields that cannot map to backend data.
- **UI never imports mocks directly.** The UI consumes service interfaces via hooks (`useEvents`, `useChains`, etc.). Mock fixtures live in `src/lib/tgdetect/mocks.ts` and are accessed only by the mock service implementations.
- **No fake backend integration.** Do not add `setInterval`-based fake streaming, fake API endpoints, or random data generators masquerading as backend data.
- **Backend repository is read-only.** Never modify `dhruvmankame/tgdetect`. The frontend must adapt to the backend, not the other way around.

## Reporting Issues

When reporting a bug, please include:
- Steps to reproduce
- Expected vs actual behavior
- Browser + OS
- Console output (if applicable)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
