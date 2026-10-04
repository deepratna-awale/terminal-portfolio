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
- `ssh <ssh host>`: the same commands in the visitor's own terminal, served by
  `ssh/` from a Lightsail instance (see "The SSH edition" below).

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
| `docs/social/` | Link preview source (`og.html`) and `render.mjs`, which writes `public/og.png` and the GitHub social preview `repo-preview.png` |
| `vite.config.ts` | Fills `index.html` tokens and generates favicon, robots.txt and sitemap.xml from ABOUT.md |
| `src/shell/runner.ts` | Runs one typed line (pipes, commands, typo hints, assistant); shared by both terminals |
| `ssh/main.ts` | SSH server (ssh2): anonymous login, connection limits, the fetch shim that sends API calls to the site |
| `ssh/session.ts` | One SSH visitor: line editor, prompt, `ShellContext` for the shared commands, SSH-specific command overrides |
| `ssh/ansi.ts`, `terminal.ts`, `images.ts`, `apps.ts` | Markdown to ANSI, key parsing and terminal detection, inline images, full-screen vim/games/matrix |
| `ssh/build-images.mjs` | Pre-renders `view` images (PNG, sixel, RGB grid) at build time |
| `terraform/` | Lightsail service, ECR, DNS, certificate, OIDC deploy role, Bedrock Guardrail, guestbook bucket, SSH instance (`ssh.tf`, `ssh-bootstrap.sh`) |
| `.github/workflows/` | `ci.yml` (lint, test, build, server and SSH smoke tests, Terraform validate), `deploy.yml`, `ssh.yml` (SSH release) |

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
`npm run build` must pass (and `npm run ssh:build` when `ssh/` or `src/shell/`
changed). CI runs the same plus server and SSH smoke tests and
`terraform fmt -check` / `terraform validate`.

## The SSH edition

`ssh/` reuses `src/shell/` (commands, completion, line editor, pipes, vim
motions, games) and `src/content.ts`, so content and commands stay
single-source. It is bundled by `ssh/vite.config.ts` into `ssh/dist/main.js`;
only `ssh2` stays external (`ssh/package.json`, installed with
`npm ci --prefix ssh`).

- Browser-only behaviour goes through `ShellContext.ui`, which `ssh/session.ts`
  implements for a terminal. Commands that open tabs (`resume`, `email`, `open`,
  `gui`, `share`) are overridden at the bottom of `ssh/session.ts` to print
  links. A new command that calls `window` or `openExternal` needs an override
  there too.
- Line types render in `Session.render`; markdown goes through `ssh/ansi.ts`.
- API calls use the same `src/api.ts`; `ssh/main.ts` rewrites relative URLs to
  `API_BASE` (the live site by default) and adds `X-Forwarded-For` with the
  visitor's address. The site trusts that header only from `TRUSTED_RELAYS`.
- Never add a way to run a process, read the instance's files or open network
  connections chosen by the visitor.

```bash
npm ci --prefix ssh && npm run ssh:build
npm run ssh                 # port 2222
node ssh/smoke.mjs 2222     # what CI runs
```

## Deploy

Merging to `main` deploys: the Deploy workflow builds the image, pushes it to
ECR and creates a Lightsail deployment. It runs in the `production` GitHub
environment (main only) and assumes an IAM role through OIDC; account values
come from repository variables (`AWS_DEPLOY_ROLE_ARN`, `SERVICE_NAME`,
`BEDROCK_GUARDRAIL_ID`, `BEDROCK_GUARDRAIL_VERSION`, `GUESTBOOK_BUCKET`) and
secrets (`BEDROCK_API_KEY`, `GUESTBOOK_*`). See the README's "Deploy your own".

The SSH edition deploys separately: `ssh.yml` builds it and uploads it to the
`ssh-latest` release (when the `SSH_ENABLED` variable is `true`), and the
instance's updater timer installs a new build within a couple of minutes. It
holds no AWS or GitHub credentials. `SSH_RELAY_IPS` (from the `ssh_relay_ips`
output) is passed to the container as `TRUSTED_RELAYS`.

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

**Feature a project.** Add the repository name under `featured` in ABOUT.md,
its share image at `public/media/projects/<name>.jpg`, and `## <repository>`
with 2 or 3 `- bullet` lines under `# Projects`. Without bullets the card shows
the GitHub description. `/gui` shows the first three. No code change.

**Add a dock icon, desktop icon or Chrome shortcut.** Put the image in
`public/icons/` and add an entry under `links` in ABOUT.md with
`show: [dock]`, `[desktop]` and/or `[newtab]`. Give it an `id` to make
`open <id>` work. No code change.

**Add a desktop window.** Call `useWindowFrame('<id>', { disabled })` from
`src/components/useWindowFrame.tsx` in the window component. Spread
`frameProps` and `style` onto the window root, `titleBar` onto its title bar,
and render `handles` inside the root. The window then behaves like a macOS
window: drag the title bar to move it, resize it from any edge or corner
(invisible zones shown only by the cursor, opposite edge anchored), with
Option/Alt to resize around the centre and Shift on a corner to keep the
aspect ratio. It stays on screen below the menu bar and remembers its position
and size per id in localStorage. Pass `disabled` while the window is maximized
or minimized so restore returns to the user's frame; it is off automatically
on phones and touch screens, where windows are full screen. Title bar buttons,
inputs, links and tabs (or anything with `data-no-drag`) keep their clicks.
Give the window `TrafficLights` for macOS controls.

**Add a skill logo.** Skill pills look up their logo by name in
`src/data/tech-icons.json` (titles and aliases, then simple-icons slug rules)
and fall back to a letter. 68 common logos from simple-icons (CC0) ship in
`public/icons/tech/`. For a new one, drop `<slug>.svg` there and add an entry
with its `title`, brand `color` (or `null` to use the text colour) and the
`names` it should match.

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
