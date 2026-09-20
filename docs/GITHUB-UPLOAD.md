# Add the submission materials to your GitHub repository

Use your existing checkout and GitHub sign-in. These steps do not change your Git author identity or repository visibility.

## 1. Copy the files

Extract `Hokigotchi-Submission-Kit.zip`. Copy its contents into:

```text
C:\Users\mrafa\OneDrive\Desktop\Budgeting-app-1
```

- Replace the root `README.md` with the new project README. Keep a local backup first if you want the old text.
- Merge the `docs` folder into the project root.
- Merge the `web` folder with the existing `web` folder. It adds `src/app/chaos` and `tests/chaos.test.mjs`.
- Keep all existing package files, APIs, game files, and `web/.env.local`.

The package is an addition to the existing app. It does not contain your credentials or replace the rest of your project.

## 2. Review the local app

Keep the development server running and open `http://localhost:3000/chaos`. If it works, replay the encounter so it is ready for your pitch.

The presentation is at `docs/presentation/Hokigotchi-Pitch.pptx`, with a PDF in the same folder. The offline demo is at `docs/demo/Hokigotchi-Chaos-Offline.html`.

## 3. Stage the project

Open a PowerShell terminal in VS Code:

```powershell
cd "C:\Users\mrafa\OneDrive\Desktop\Budgeting-app-1"
git remote -v
git status --short
git check-ignore -v web/.env.local
git ls-files -- web/.env.local
```

The remote should be your intended Budgeting-app repository. `check-ignore` should show the ignore rule; `git ls-files` should print nothing for `.env.local`. If the file is tracked, stop before committing and remove it from the index with `git rm --cached -- web/.env.local`, which keeps the local file. Previously published credentials need replacement.

If you only want the presentation and documentation:

```powershell
git add README.md docs
```

To include the new Chaos route and your current uncommitted app work for the full submission:

```powershell
git add README.md docs web
```

Review exactly what is staged:

```powershell
git diff --cached --stat
git diff --cached --name-only
```

The file list should include the intended source and presentation files. It should not contain `.env.local`, `node_modules`, or `.next`. If an unintended file appears, remove just that file from staging with `git restore --staged -- path/to/file` before continuing.

## 4. Commit and push

```powershell
git commit -m "Add Hokigotchi pitch, documentation, and Chaos demo"
git push origin main
```

Use the same branch you have been working on if it is not `main`. Complete browser authentication if Git asks. If Git rejects a push because the remote changed, do not force-push; inspect and reconcile the changes first.

## 5. Check the submission

Open your repository on GitHub. Check that the README images load, the PDF downloads, and the code includes the latest game changes. The PPTX and PDF are inside `docs/presentation`.

A private repository requires access for the judges if the event expects them to review it. Follow the event's stated sharing requirements; this package does not change your repository's visibility.

GitHub stores the app code and files. Pushing this Next.js project does not automatically create a publicly hosted application. Use a demo recording if the event accepts one and deployment would risk your deadline.
