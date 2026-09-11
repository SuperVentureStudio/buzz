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
`buzz-desktop` keychain identity. Its `Info.svs.plist` overlay changes the
Finder and Dock name to `SVS`. Use this build to replace the installed app.

### Build prerequisites

The replacement build needs Node, pnpm and a current Rust toolchain. On the
SVS Mac, Homebrew provides Rust and Corepack exposes the repository's pnpm:

```bash
brew install rust
corepack enable
```

The build guard in `desktop/scripts/tauri-command.mjs` rejects missing, empty,
or non-executable macOS sidecars. Keep the real `*-aarch64-apple-darwin`
sidecars in `desktop/src-tauri/binaries/`; do not package CI placeholder files.

The source mark is `desktop/src-tauri/icons/svs-source.png`. Regenerate the
macOS icon set from that mark before changing any icon sizes. Build the branded
desktop app with:

```bash
cd desktop
pnpm tauri:build:svs:replace
```

The bundle is written to
`desktop/src-tauri/target/release/bundle/macos/SVS.app`. Before installation,
ad-hoc sign the completed local bundle so its current resources and
`Info.plist` are sealed:

```bash
codesign --force --deep --sign - src-tauri/target/release/bundle/macos/SVS.app
codesign --verify --deep --strict src-tauri/target/release/bundle/macos/SVS.app
```

To install, quit SVS, move `/Applications/SVS.app` to a dated directory under
`~/svs/var/backups/buzz/`, copy the verified bundle into `/Applications`, then
launch it. Moving rather than deleting makes app rollback immediate. Do not
change the replacement bundle identifier: it is what preserves existing Buzz
profiles, managed-agent records, relay identity and local data.

Managed-agent records live in
`~/Library/Application Support/xyz.block.buzz.app/agents/managed-agents.json`.
The file holds agent private keys: read only names and `env_vars` keys, copy it
into the same dated backup directory, and edit it only while SVS is quit, or
the running app can overwrite the change.

This Mac has no screen-recording permission for the terminal, so `screencapture`
cannot verify the installed app. Cover UI changes with unit tests and ask
Faisal to check the real window.

## SVS visual system

SVS uses `svs` and `svs-dark` as its first-class themes. Historical `buzz` and
`buzz-dark` selections are migrated on read, including community preferences;
storage keys remain unchanged so existing profiles keep their data. The themes
reuse GitHub's syntax palette but own SVS's cyan accent and gradient.

The macOS main window is transparent from creation. `ThemeProvider.tsx` installs
the native material through `set_window_vibrancy` before making the WebView
transparent; `theme.css` then applies controlled translucent layers to the
outer chrome, sidebar and primary workspace panes. Glass defaults on for a new
SVS profile, while an explicit off preference stays off.

The user preference is stored as `buzz-glass-background`; tint opacity is
stored separately and applied through `--glass-background-opacity`. Keep glass
user-controllable, macOS-specific and contrast-safe. New SVS visual work should
change the existing theme tokens; message content, compose surfaces, dialogs
and dense operational controls remain legible opaque layers.

MonoCode is a useful visual reference, not a dependency: its macOS treatment
uses a transparent root and layered translucent workspace panes, with
user-controlled opacity. For SVS, reuse that hierarchy with the existing cyan
brand accent and native vibrancy rather than importing MonoCode components,
state, or window-management code.

When refining the look, verify all three states on a real macOS desktop:

1. Glass off: no visual or contrast regression.
2. Glass on with a light wallpaper: readable labels, inputs and selected rows.
3. Glass on with a dark wallpaper: sidebar separation, modal readability and
   visible macOS traffic lights.

## SVS-managed agents

SVS-managed agents are external SVS runtimes that communicate through Buzz;
they are not processes launched or supervised by the desktop app. Mark their
persisted managed-agent record with `env_vars.SVS_MANAGED = "1"`. The profile
and direct-message sidebar render this as the cyan SVS marker and suppress
local Start/Stop controls. This is intentionally separate from relay presence:
the normal green/away/offline indicators describe a Buzz relay session, whereas
the cyan marker describes SVS ownership and remains visible while no local
`buzz-acp` process exists. Keep ordinary contacts on the existing presence path.

Add `env_vars.SVS_ACTOR_ID` (for example `actor:maya`) to give the profile an
"SVS profile · Open in SVS" row that opens the agent's page in the loopback
SVS web app (`http://localhost:5173/team/agents/<id>`). Without it, no link is
shown. The observer feed labels SVS turns "Working" rather than naming an
agent, so a second SVS-managed agent is never shown as Maya.

Buzz is the conversation console; boards, dashboards and the full agent
directory stay in the SVS web app, per the operating layer's Buzz/dashboard
split. Add Buzz source changes only for a gap in conversation, and link to the
web app for anything that is looked up rather than answered.
