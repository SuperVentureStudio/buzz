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
sign the completed local bundle with the `SVS Local Signing` certificate so its
current resources and `Info.plist` are sealed:

```bash
codesign --force --deep --sign "SVS Local Signing" src-tauri/target/release/bundle/macos/SVS.app
codesign --verify --deep --strict src-tauri/target/release/bundle/macos/SVS.app
```

Never ad-hoc sign (`--sign -`). Before SVS reads the `buzz-desktop` keychain
item, macOS checks two lists on it. The access list trusts an app by its
signature: `SVS Local Signing` (a self-signed certificate in the login
keychain, trusted for code signing only) keeps that trust across builds. The
partition list trusts an app by its Apple Team ID, and an app without one only
by its exact build (`cdhash:`). A self-signed certificate has no Team ID, so
each new install still asks for the login password once; click Always Allow.
Only an Apple-issued certificate with a Team ID (a free Apple Development
certificate from Xcode, or a paid Developer ID) removes that last prompt.
Check with `security find-identity -v -p codesigning` and
`codesign -dvvv /Applications/SVS.app` (`TeamIdentifier`).

To install, quit SVS, move `/Applications/SVS.app` to a dated directory under
`~/svs/var/backups/buzz/`, copy the verified bundle into `/Applications`, then
launch it. Moving rather than deleting makes app rollback immediate. Do not
change the replacement bundle identifier: it is what preserves existing Buzz
profiles, managed-agent records, relay identity and local data.

Confirm the install by hashing the binary against the one just built
(`shasum -a 256 .../Contents/MacOS/buzz-desktop`): a copy that silently failed
looks exactly like a change that did not take effect.

Budget for the loop. A first release build of the Rust workspace runs 20-30
minutes; a frontend-only change reuses the cargo cache and takes about two.
Batch frontend fixes into one build rather than rebuilding per fix, and never
run `vite`/`build:e2e` into `dist` while Playwright is serving it.

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

The macOS main window is transparent from creation. `ThemeProvider.tsx` calls
`set_window_glass` before making the WebView transparent: that makes the
`NSWindow` itself transparent and asks the WindowServer to blur what is behind
it, through the private `CGSSetWindowBackgroundBlurRadius`. `theme.css` then
applies controlled translucent layers to the outer chrome, sidebar and primary
workspace panes.

`NSVisualEffectView` (the `window-vibrancy` crate, `set_window_vibrancy`) is the
fallback for a macOS that no longer exports that symbol. It is not the default
because each of its materials composites a fixed tint that no CSS opacity above
it can lift, so the glass could never reach the clear end of the opacity range.

Glass defaults on for a new SVS profile, while an explicit off preference
stays off.

Because nothing now sits between the desktop and the page, **there is no page
colour left to paint with.** Any element that hides content by filling a strip
with `bg-background` — a sticky header's scroll mask, a rail mask, a fade —
becomes a visible box the moment glass is on. Two rules follow:

- Do not mask scrolled content with a fill. Arrange the layout so nothing
  shows through: keep a sticky element's own padding out of the sticky box so
  the sticky box is exactly the surface, and let content disappear at its edge.
- Recolouring such a mask does not fix it. A tinted band is still a band.

The user preference is stored as `buzz-glass-background`; tint opacity is
stored separately and applied through `--glass-background-opacity`. Keep glass
user-controllable, macOS-specific and contrast-safe. New SVS visual work should
change the existing theme tokens; message content, compose surfaces, dialogs
and dense operational controls remain legible opaque layers.

MonoCode is a useful visual reference, not a dependency: its macOS treatment
uses a transparent root and layered translucent workspace panes, with
user-controlled opacity, and `CGSSetWindowBackgroundBlurRadius` is the
mechanism SVS took from it. For SVS, reuse that hierarchy with the existing
cyan brand accent rather than importing MonoCode components, state, or
window-management code.

When refining the look, verify all three states on a real macOS desktop:

1. Glass off: no visual or contrast regression.
2. Glass on with a light wallpaper: readable labels, inputs and selected rows.
3. Glass on with a dark wallpaper: sidebar separation, modal readability and
   visible macOS traffic lights.

## Traps this fork has already paid for

Each of these cost a wrong fix or a wasted build. Read before assuming.

**Unread state is in a database, not in the React code.** The sidebar's bold
row and its dot come from
`~/Library/Application Support/xyz.block.buzz.app/observed-unread.db`.
`observed_events` holds each unread event — `root_id` set means a thread reply,
null means a top-level post — and `read_markers` holds `<channelId>`,
`thread:<rootId>` and `msg:<id>` contexts. An event is read once some marker
covering it is newer than its `created_at`. Query it. Reasoning about the
unread memo instead produced two confident wrong diagnoses in a row; one
`sqlite3` query settled it.

**The E2E mock bridge never runs the read-state path.** No `markChannelRead`
call reaches it, so an unread spec written against the mock passes with or
without the fix it claims to protect. Do not write one — it is worse than no
test. Verify unread behaviour against the database above.

**Forum channels disable the chat messages query.** `useChannelMessagesQuery`
is `enabled: channel.channelType !== "forum"`. Anything derived from it is
structurally null for a forum. That is why the channel read marker was never
written for forums: `ChannelScreen` took the marker timestamp from that query.
Check the predicate before reusing a value from it on a forum surface.

**`VirtualizedList` rows ignore the spacer's padding.** Rows are absolutely
positioned, so their containing block is the spacer's padding box: padding on
`innerClassName` moves nothing, vertically or horizontally. Put list padding on
a real block wrapper around the list instead. A centred column still works via
`max-w-*`/`mx-auto` on the spacer, but it leaves no side gutter on a narrow
window.

**A synchronous Tauri command already runs on the main thread.** AppKit work
belongs inline in it. Wrapping that work in `run_on_main_thread` and blocking on
the result deadlocks, because the queue being waited on is the thread doing the
waiting. `set_window_vibrancy` makes the same assumption.

**Some odd-looking layout is a test-protected invariant.** The inbox message
action bar deliberately stays inside the first message rather than straddling
its top edge, and `inbox-reactions.spec.ts` asserts it. Making it consistent
with the channel timeline broke that test — correctly. Before "fixing"
placement that looks inconsistent, grep the specs for it; the inconsistency may
be load-bearing.

**The mock's light theme hides dark-glass defects.** `just desktop-screenshot`
renders the light theme, where an opaque mask is invisible against an opaque
page. A screenshot that looks right there says nothing about glass-on dark.
Ask Faisal for that one; this Mac has no screen-recording permission.

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
