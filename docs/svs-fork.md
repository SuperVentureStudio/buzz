# SVS fork

`main` mirrors Block's `main`. SVS changes live only on the `svs` branch.
Keeping the branches separate makes upstream updates reviewable and avoids
mixing SVS branding with upstream history.

## Update from upstream

From the repository root, first ensure the working tree is clean, then run:

```bash
git fetch upstream
git switch main
git merge --ff-only upstream/main
git push origin main
git switch svs
git rebase main
git push --force-with-lease origin svs
```

Resolve and test any rebase conflict on `svs`; never merge `svs` back into
`main`.

## SVS desktop builds

`desktop/src-tauri/tauri.svs.conf.json` is the isolated build: a separate app
identity and URL scheme for development or a side-by-side test. Its local state
is separate from the installed Buzz app.

`desktop/src-tauri/tauri.svs.replace.conf.json` is the replacement build. It
keeps Buzz's production bundle identifier and URL scheme, so macOS resolves the
same app-data directory and the release build reads the existing
`buzz-desktop` keychain identity. Use this build to replace the installed app.

The source mark is `desktop/src-tauri/icons/svs-source.png`. Regenerate the
macOS icon set from that mark before changing any icon sizes. Build the branded
desktop app with:

```bash
cd desktop
pnpm tauri:build:svs:replace
```
