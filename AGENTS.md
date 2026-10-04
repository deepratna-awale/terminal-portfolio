# AGENTS.md

Onboarding for AI coding agents (and humans) working in this repository. Read
this first; the README covers the same ground for people deploying a fork.

## What this is

A personal portfolio served two ways from one container:

- `/`: a fake macOS desktop with a zsh-like terminal (SSH boot sequence,
  commands, tab completion, vim, pipes, games) and an in-site "Chrome" window.
  Anything typed that is not a command goes to an AI assistant on Amazon
  Bedrock, behind a Bedrock Guardrail.
- `/gui`: the same content as a normal portfolio page, prerendered at build
  time for crawlers and no-JS visitors.

React 19 + Vite + TypeScript on the client; a dependency-free Node server
(`server/index.mjs`) for static files and `/api/*`; Terraform on AWS Lightsail;
GitHub Actions deploys every push to `main`.

## Golden rule: content is data

**All site content comes from [`ABOUT.md`](ABOUT.md)**, colour themes from
[`themes/`](themes), and images from `public/`. Never hardcode a name, link, domain, job, icon or label in code.
If a change needs new content, add a frontmatter key or a section to ABOUT.md
and read it through `src/content.ts` (client) or `server/about.mjs` (server).

- Frontmatter (YAML subset: scalars, `[a, b]`, `- item` lists, lists of maps,
  indented maps, `key: |` blocks) holds the profile, SEO text, OS name, login
  banner, neofetch rows, featured repositories, media, ASCII logo and `links`.
- Each `# Heading` is a section: a terminal command, an `ls`/`cat` file and a
  `/gui` section with a nav link. An optional `<!-- command: x | nav: y | help: z -->`
  line under a heading sets its command name, nav label and help text.
- `# Assistant` is private: its `## Rules` list is appended to the assistant's
  rules and the rest is extra background. It never renders on the site.
- `links` entries drive dock icons, desktop icons, Chrome new-tab tiles and
  `open <id>` targets (`show: [dock, desktop, newtab]`). Icon images live in
  `public/icons/`.

The parser is `shared/about.js` (plain JS with `shared/about.d.ts`, so the
client, server and Vite config share it). Its tests are in
`src/shell/about.test.ts`.

## Map of the code

| Path | What lives there |
| --- | --- |
| `ABOUT.md` | All content (see above) |
| `shared/about.js` | ABOUT.md parser, `siteProfile`, assistant facts |
| `src/content.ts` | Client view of ABOUT.md: `profile`, `sectionList`, `sections`, `links`, `linksFor`, media, OS |
| `src/App.tsx`, `src/App.css` | Desktop: menu bar menus, dock, desktop icons, windows, overlays |
| `src/components/Terminal.tsx` | Terminal UI, boot script, input handling, assistant calls |
| `src/components/SectionView.tsx` | Rich terminal layouts for known sections; generic markdown box for others |
| `src/components/Browser.tsx` | In-site Chrome window: tabs, address bar, new-tab page |
| `src/shell/commands.ts` | Every built-in command; section commands are generated from ABOUT.md |
| `src/shell/completion.ts`, `lineEditor.ts`, `pipes.ts`, `vim.ts`, `deeplink.ts` | Tab completion, zsh keys, pipes, vim motions, `?cmd=` links |
| `src/gui/Portfolio.tsx`, `parse.ts`, `address.ts` | `/gui` page, section parsers, in-site address bar rules |
| `themes/*.json` | Colour themes, one file each, shared by the terminal and `/gui` (shadcn/tweakcn exports work as-is) |
| `src/themes.ts` | Loads `themes/` with `import.meta.glob` and turns each file into CSS variables |
| `src/games/` | Snake and 2048 logic |
| `server/index.mjs` | HTTP server, security headers, `/api/chat`, `/api/projects`, `/api/guestbook`, `/api/contributions`, `/gui` |
| `server/about.mjs` | Server view of ABOUT.md: profile, featured repos, assistant rules and facts |
| `server/bedrock.mjs`, `s3.mjs`, `rateLimit.mjs` | Bedrock Converse client, S3 SigV4 signing, rate limits |
| `scripts/prerender.mjs` | Writes `dist/gui.html` from the SSR build |
| `vite.config.ts` | Fills `index.html` tokens and generates favicon, robots.txt and sitemap.xml from ABOUT.md |
| `terraform/` | Lightsail service, ECR, DNS, certificate, OIDC deploy role, Bedrock Guardrail, guestbook bucket |
| `.github/workflows/` | `ci.yml` (lint, test, build, server smoke test, Terraform validate), `deploy.yml` |

## Run, test, build

```bash
npm install
npm run dev          # Vite on :5173, proxies /api to :8787
npm run api          # Node server on :8787 (second terminal)
npm test             # Vitest
npm run lint         # oxlint (existing warnings are known; add no new ones)
npm run build        # tsc -b, client build, SSR build, prerender of /gui
```

`npm run build && PORT=8799 npm run api` serves the production build. The
assistant needs `AWS_BEARER_TOKEN_BEDROCK`, `BEDROCK_GUARDRAIL_ID` and
`BEDROCK_GUARDRAIL_VERSION`; without them it reports that it is offline.
`fortune` and `cowthink` need the binaries (`brew install fortune cowsay`).

Before opening a PR: `npx tsc -b`, `npm test`, `npm run lint` and
`npm run build` must pass. CI runs the same plus a server smoke test and
`terraform fmt -check` / `terraform validate`.

## Deploy

Merging to `main` deploys: the Deploy workflow builds the image, pushes it to
ECR and creates a Lightsail deployment. It runs in the `production` GitHub
environment (main only) and assumes an IAM role through OIDC; account values
come from repository variables (`AWS_DEPLOY_ROLE_ARN`, `SERVICE_NAME`,
`BEDROCK_GUARDRAIL_ID`, `BEDROCK_GUARDRAIL_VERSION`, `GUESTBOOK_BUCKET`) and
secrets (`BEDROCK_API_KEY`, `GUESTBOOK_*`). See the README's "Deploy your own".

Terraform: `terraform/terraform.tfvars` and `terraform/backend.hcl` are
gitignored per-deployment files (copy the `.example` files). Init with
`terraform init -backend-config=backend.hcl`. Changing the guardrail publishes
a new version; set the `BEDROCK_GUARDRAIL_VERSION` variable to the new
`guardrail_version` output and redeploy. IAM and other infrastructure applies
need a human's go-ahead; review a saved plan before applying.

## Conventions

- Match the surrounding style: no semicolons, single quotes, two-space indent,
  compact one-line helpers, few comments (one line explaining why, not what).
- TypeScript is strict about unused code (`noUnusedLocals`); keep `tsc -b` clean.
- The server has no runtime npm dependencies. Keep it that way.
- Never put secrets, keys or personal data other than what ABOUT.md publishes
  into the repo, Terraform state or client code. The browser never sees
  credentials.
- Third-party GitHub Actions are pinned to commit SHAs.
- Keep `/gui` working without JavaScript (it is prerendered).
- Commits and PRs: descriptive branch names, imperative commit subjects, PR
  body with "Before:" and "After:" paragraphs. No AI attribution trailers.

## Common tasks

**Add a portfolio section.** Add `# Heading` and markdown to ABOUT.md. It
becomes a command, a file and a `/gui` section automatically. Only write code
if it needs a custom layout: add a renderer for its id in
`src/components/SectionView.tsx` (terminal) and in the `renderers` map in
`src/gui/Portfolio.tsx` (`/gui`).

**Add a dock icon, desktop icon or Chrome shortcut.** Put the image in
`public/icons/` and add an entry under `links` in ABOUT.md with
`show: [dock]`, `[desktop]` and/or `[newtab]`. Give it an `id` to make
`open <id>` work. No code change.

**Add a desktop window.** Call `useResizable('<id>', { disabled })` from
`src/components/useResizable.tsx` in the window component, spread its `style`
onto the window frame (which needs `position: relative`, `fixed` or
`absolute`) and render its `handles` inside it. The window then resizes from
every edge and corner, is clamped to the viewport, and remembers its size per
id in localStorage (double-click a handle to reset). Pass `disabled` while the
window is maximized or minimized so restore returns to the user's size; it is
off automatically on touch and narrow screens, where windows are full screen.
Use `anchor: 'top'` with `onTopShift` for windows positioned from the top
rather than centred (see `Browser.tsx`). Give it `TrafficLights` for macOS
controls.

**Add a built-in command.** Add an entry to `commands` in
`src/shell/commands.ts` (`group`, `summary`, optional `usage`/`hidden`,
`run`). It appears in `help` and completion automatically. Add a test in
`src/shell/features.test.ts` or `shell.test.ts`.

**Add or change a theme.** Drop a JSON file into `themes/` (the file name is
the theme id; see the README's Themes section for the format). The `theme`
command, completion and menus pick it up. No code change.

**Change the assistant's behaviour.** Facts and owner-specific rules go in the
`# Assistant` section of ABOUT.md. Generic rules and limits are in
`systemPrompt()` and the rate limiters in `server/index.mjs`. What it refuses
at the model level is the Bedrock Guardrail in `terraform/guardrail.tf`
(`guardrail_denied_topics` in tfvars); denied topics also check answers, so
avoid topics that overlap the owner's own work.

**Add an API endpoint.** Route it in the `createServer` handler in
`server/index.mjs`, validate input, rate-limit anything that costs money, and
check `Origin` against `allowedOrigins` for writes. Extend the CSP only if a
new external origin is truly needed.

**Change infrastructure.** Edit `terraform/`, run `terraform fmt -recursive`
and `terraform validate`, and share the plan before anyone applies it.
