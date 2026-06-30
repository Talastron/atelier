# Repo Migration Runbook

Two related moves, sequenced so you migrate the codebase **once**:

1. **Part A** — give the code a new GitHub home (your own org, or company GitHub).
2. **Part B** — absorb this app into the `atelier-website` monorepo as `apps/studio`.

> **Decide the end-state home BEFORE doing either.** Don't transfer `digital-wardrobe`
> to a new account and *then* merge it into the monorepo — that's two disruptions and
> throws away the subtree history benefit. Pick the destination, move the monorepo there,
> then subtree the app in.

Context (verified 2026-06-30):
- App repo: `billiesherwood/digital-wardrobe` (personal), SSH alias `github.com-personal`.
- Deploys **manually** via `firebase deploy` — **no GitHub Actions**, so nothing CI to reconnect.
- App = React 18 + **npm** (`package-lock.json`).
- Target monorepo `Talastron/atelier` = pnpm, React 19 islands, `apps/studio` is an empty stub reserved for this app.
- `firebase.json` deploys hosting (`dist`), firestore rules, and functions from the repo root.

---

## Part A — Move to a new GitHub home

### A0. Decide ownership first (the real question)
- **Your own org** (e.g. `atelier-style`, free) — clean separation from personal account,
  *you* keep the IP. Recommended unless this is officially a company product.
- **Company GitHub** — only if this is genuinely becoming a company asset. Be aware this can
  entangle IP/ownership depending on your employment terms.

### A1. Add an SSH identity for the new account
You can't reuse one SSH key across two GitHub accounts. Create a second key and a host alias.

```bash
# generate a dedicated key
ssh-keygen -t ed25519 -C "atelier-github" -f ~/.ssh/id_ed25519_atelier
```

Add the **public** key (`~/.ssh/id_ed25519_atelier.pub`) under the new account/org:
GitHub → Settings → SSH and GPG keys → New SSH key.

Add a host alias in `~/.ssh/config`:

```sshconfig
Host github.com-atelier
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_atelier
    IdentitiesOnly yes
```

Test: `ssh -T git@github.com-atelier` (expect "Hi <user>! You've successfully authenticated").

### A2. Get the repo into the new home
**Option 1 — GitHub Transfer (preferred: keeps history, issues, PRs, sets up URL redirects):**
- On the source repo: Settings → General → Danger Zone → **Transfer ownership** → new org.
- Requires you to be a member of the destination org with repo-creation rights.
- Company orgs may enforce SSO / app restrictions — an admin may need to allowlist first.

**Option 2 — Push to a fresh repo (clean slate, no issues/PRs carried over):**
```bash
# create the empty repo in the new org via the web UI first, then:
git remote rename origin old-origin
git remote add origin git@github.com-atelier:ORG/digital-wardrobe.git
git push -u origin --all
git push origin --tags
```

### A3. Re-point your local remote (if you used Transfer)
```bash
git remote set-url origin git@github.com-atelier:ORG/digital-wardrobe.git
git remote -v   # confirm
git fetch origin
```

### A4. What does NOT break
- **The live site stays up.** Firebase Hosting serves the already-deployed `dist`; it has no
  link to GitHub. `edit.myatelier.style` is unaffected throughout.
- **No CI secrets to migrate** — you deploy manually, so there's no Actions workflow to fix.
- Firebase project (`my-digital-wardrobe-444d0`) is unchanged; `firebase deploy` keeps working.

### A5. Loose ends to check
- Update the remote on any **other clones** (laptop, etc.).
- If you ever add GitHub Actions later, that's when secrets matter — not now.
- Re-invite collaborators; reapply branch protection if the old repo had any.

---

## Part B — Absorb the app into the monorepo as `apps/studio`

Do this **after** Part A (so you only subtree into the final home) and **at a clean
app-dev checkpoint** — not mid-feature. You currently have ~25 active `p*` branches; merge
or park them first, because subtree rewrites the path of every file.

### B1. Pull the app in WITH history
From the `atelier-website` monorepo root:

```bash
# add the app repo as a remote (use whichever alias points at its new home)
git remote add studio-src git@github.com-atelier:ORG/digital-wardrobe.git
git fetch studio-src

# the apps/studio stub must be empty/removed first, then:
git subtree add --prefix=apps/studio studio-src main
```

This preserves the app's full commit history under `apps/studio/`. Zero impact on data,
hosting, or the domain — the app keeps deploying to Firebase Hosting.

### B2. Resolve the npm → pnpm mismatch (the main wrinkle)
The monorepo is pnpm; the app shipped with npm. Pick one:

- **Convert the app to the pnpm workspace (recommended for true single-repo):**
  ```bash
  cd apps/studio
  rm package-lock.json
  cd ../..
  # ensure apps/* is covered by pnpm-workspace.yaml, then:
  pnpm install
  ```
  Watch for peer-dep resolution differences; run the app and a build to confirm parity.

- **Keep the app on its own npm island (lower effort, less benefit):** leave
  `package-lock.json`, exclude `apps/studio` from the pnpm workspace, run npm inside it.
  You get co-location but not shared dependency hoisting. A reasonable interim step.

### B3. Fix the Firebase deploy path
`firebase.json` + `.firebaserc` currently sit at the app's root and reference `dist`,
`firestore.rules`, and `functions/` relative to it. After the move they live in `apps/studio/`.
Either:
- Run deploys from `apps/studio/` (`cd apps/studio && firebase deploy`), or
- Hoist a Firebase config to the monorepo root with corrected relative paths.
Verify with `firebase deploy --only hosting` to a preview channel before production.

### B4. Dedupe the design system (the payoff — kills the drift problem)
This is the whole reason for the monorepo: stop the marketing site's app-preview components
from drifting from the real app.

- Replace the app's **local** `EditorialHeader`, `AtelierMark`, and brass-tone tokens with
  imports from `@atelier/ui` + `@atelier/design-tokens`.
- Have `apps/marketing` import the **same** `packages/ui` components for its app previews.
  Single source of truth → drift becomes structurally impossible.

> **React 18 vs 19 caution:** the app is React 18, marketing islands are React 19. Anything
> hoisted into shared `packages/ui` must stay compatible with BOTH, or you trade drift-pain
> for dependency-pain. Start by sharing **tokens** (framework-agnostic) before components.

### B5. Verify before calling it done
- App builds and runs from its new path.
- `firebase deploy` to a preview channel renders correctly.
- Marketing previews now render the shared components.
- Commit the subtree + dedup as separate, reviewable commits.

---

## Recommended order of operations
1. Decide ownership (A0).
2. Move `atelier-website` (the monorepo) to the chosen home + set up SSH (A1).
3. Move/transfer `digital-wardrobe` to the same home (A2–A3).
4. At a clean app checkpoint: subtree into `apps/studio` (B1).
5. pnpm + Firebase path fixes (B2–B3), verify.
6. Design-system dedup, starting with tokens (B4), verify (B5).

Reminder: none of this wins a user. Per the GTM plan, demand is the bottleneck — treat this
as a maintainability investment to slot in between app-dev milestones, not a launch task.
