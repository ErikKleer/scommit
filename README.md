# SCOMMIT

**Autonomous CLI for Conventional Commits, PR Summaries & Risk Scoring**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Zod](https://img.shields.io/badge/Zod-schema--validated-3E67B1)](https://zod.dev/)
[![Google Gemini Flash](https://img.shields.io/badge/Google%20Gemini-Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev/gemini-api)
[![Groq](https://img.shields.io/badge/Groq-Llama%203.3-F55036)](https://groq.com/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

![scommit demo preview](./docs/assets/demo.gif)

_The interactive terminal flow previews the generated commit, PR summary, and risk score, then lets the developer commit, copy the summary, do both, or cancel without leaving the shell._

## Problem Statement

Commit hygiene is often a repeated manual tax: developers spend several minutes turning a staged diff into a correctly scoped Conventional Commit, reviewers reconstruct context for PR descriptions, and release owners make deployment decisions with incomplete risk signals. Across a team making 20 commits per engineer per week, even five minutes of formatting and summarization becomes more than 33 engineer-hours per month for 10 engineers. The harder cost is inconsistency: subjective summaries and unstructured risk notes make changes difficult to scan and compare.

`scommit` makes the staged diff the source of truth. It produces a Conventional Commit message, a structured PR summary, and a 1-to-5 risk score with a reason, while keeping the final execution decision with the developer.

## Architecture & Pipeline

![scommit Architecture & Data Flow](./docs/assets/architecture.png)

```text
Git Staged Delta -> Context Sanitizer (Hunk & Token Pruning) -> LLM Gateway (Structured Outputs)
                 -> Zod Schema Validation -> Interactive CLI UI -> Git Execution / Clipboard
```

The pipeline is intentionally narrow and inspectable:

1. **Diff Extraction**: runs `git diff --cached --no-ext-diff`, requires staged content, and passes only the staged delta to the analysis boundary.
2. **Token Pruning**: parses files and hunks, prioritizes source files, bounds each file body, and fits the selected context to the configured character budget.
3. **LLM Inference**: sends a deterministic system instruction to either Google Gemini or Groq. Provider selection is explicit, with automatic selection based on configured credentials.
4. **Schema Enforcement**: requests JSON or native response schemas where supported, parses the payload, and validates every field with Zod before rendering or executing anything.
5. **Terminal / Clipboard UX**: renders the commit and risk preview, formats the PR summary as Markdown, and exposes commit, copy, combined, and cancel actions.

## Engineering Highlights & Trade-offs

### Deterministic Output Contract

The output contract is represented once in `CommitAnalysisSchema`: the commit must match Conventional Commit syntax, the summary fields must be non-empty where required, and the risk score must be an integer from 1 through 5. Gemini receives a native JSON response schema; Groq receives JSON mode. Zod remains the trust boundary for both providers, so malformed JSON, missing fields, and semantically invalid values fail before a commit or clipboard write is attempted. This does not make model output infallible; it makes invalid output observable and non-executable.

### Token Conservation Strategy

Diff context is conserved in three layers:

- Hunk-aware rendering preserves diff metadata and only slices hunk content when a file exceeds its budget.
- Source files are prioritized over secondary documentation and lower-signal file types. Lockfiles and other generated artifacts are naturally deprioritized by the extension policy rather than given equal weight with source code.
- The default analysis bound is 16,000 characters, with a `--max-chars` override for controlled experiments or unusually large changes. Individual file bodies are capped at 4,000 characters and marked when truncated.

The trade-off is deliberate: a bounded, representative diff usually yields a faster and more stable explanation than an unbounded payload, while the explicit truncation marker makes lost context visible to the model and the operator.

### Sub-2s Latency Architecture

The CLI performs one local Git read, one compact prompt, and one provider request. Flash-class models such as Gemini Flash are designed for low-latency structured generation; Groq's Llama path is a practical alternative when fast inference and provider diversity matter more than using a larger reasoning model. The repository currently configures Gemini's Flash model and Groq's llama model identifiers can be updated independently of the CLI contract.

Treat sub-two-second response time as a target for normal-sized staged diffs, not a universal guarantee. Network distance, provider load, quota state, diff size, and cold starts are external variables. The architecture keeps the local portion deterministic and small so provider latency is the dominant, measurable term.

## Getting Started

### Prerequisites

- Node.js 18 or newer
- Git
- An API key for at least one supported provider

### Installation

Install the published CLI globally:

```bash
npm install -g scommit
```

For local development:

```bash
git clone <repository-url>
cd scommit
npm install
npm run build
npm link
```

### Environment

Copy `.env.example` to `.env` and set one or both provider keys:

```dotenv
GEMINI_API_KEY="your_gemini_api_key_here"
GROQ_API_KEY="your_groq_api_key_here"
```

When no provider is passed, `scommit` uses Groq when `GROQ_API_KEY` is configured and otherwise uses Gemini. Provider errors and rate limits are surfaced as actionable CLI errors.

## Usage

Stage changes first, then run:

```bash
scommit
scommit --dry-run
scommit --provider gemini
scommit --max-chars <n>
```

| Command                     | Purpose                                                              |
| --------------------------- | -------------------------------------------------------------------- |
| `scommit`                   | Analyze the staged diff, show the preview, and open the action menu. |
| `scommit --dry-run`         | Show the analysis without committing or copying anything.            |
| `scommit --provider gemini` | Force the Gemini provider for this invocation. Use `groq` for Groq.  |
| `scommit --max-chars <n>`   | Set the maximum staged-diff characters sent to the model.            |

### Interactive Menu

After the analysis preview, the terminal presents four actions:

- **Commit directly**: execute `git commit` using the generated Conventional Commit message.
- **Copy PR Summary & Commit**: copy the Markdown PR summary to the system clipboard, then create the commit.
- **Copy PR Summary only**: copy the summary without changing Git history.
- **Cancel**: exit without copying or committing.

`--dry-run` is the review and automation-friendly mode: it renders the same generated artifacts while bypassing the interactive action boundary.

## Development

```bash
npm run dev -- --help
npm run build
```

The project is a small TypeScript ESM CLI. Provider integrations live behind the LLM client, the schema is centralized, and Git mutation is kept behind the action layer so the analysis path remains testable and reviewable.

## License

MIT
