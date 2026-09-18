import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const tauriPackageJsonPath = fileURLToPath(
  import.meta.resolve("@tauri-apps/cli/package.json"),
);
const tauriPackage = JSON.parse(readFileSync(tauriPackageJsonPath, "utf8"));
const defaultTauriEntrypoint = path.resolve(
  path.dirname(tauriPackageJsonPath),
  tauriPackage.bin.tauri,
);

const macSidecars = [
  "buzz-acp",
  "buzz-agent",
  "buzz-backend-kubernetes",
  "buzz-dev-mcp",
  "git-credential-nostr",
  "buzz",
];

function targetTriple(args) {
  const index = args.findIndex((arg) => arg === "--target");
  if (index >= 0) return args[index + 1];
  const inline = args.find((arg) => arg.startsWith("--target="));
  if (inline) return inline.slice("--target=".length);
  if (process.platform === "darwin") {
    return process.arch === "arm64"
      ? "aarch64-apple-darwin"
      : "x86_64-apple-darwin";
  }
  return undefined;
}

/** Refuse a package that would silently contain the CI's empty sidecar stubs. */
export function assertBundledSidecars(args) {
  const target = targetTriple(args);
  if (!target?.endsWith("apple-darwin")) return;
  for (const name of macSidecars) {
    const sidecar = path.join(
      desktopRoot,
      "src-tauri",
      "binaries",
      `${name}-${target}`,
    );
    let stat;
    try {
      stat = statSync(sidecar);
    } catch {
      throw new Error(
        `Missing bundled sidecar: ${sidecar}. Run scripts/bundle-sidecars.sh first.`,
      );
    }
    if (!stat.isFile() || stat.size < 1024 || (stat.mode & 0o111) === 0) {
      throw new Error(
        `Invalid bundled sidecar: ${sidecar}. Run scripts/bundle-sidecars.sh first.`,
      );
    }
  }
}

function runTauri(args, options = {}) {
  const entrypoint =
    process.env.BUZZ_TAURI_CLI_ENTRYPOINT ?? defaultTauriEntrypoint;
  const result = spawnSync(process.execPath, [entrypoint, ...args], {
    cwd: desktopRoot,
    env: { ...process.env, ...options.env },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

export function runTauriCommand(args) {
  if (args[0] !== "build") return runTauri(args);
  assertBundledSidecars(args);

  // Tauri runs beforeBuildCommand and then consumes frontendDist. Give the
  // entire invocation a private directory so concurrent OSS/internal packages
  // cannot replace one another's assets between those two operations.
  let invocationRoot = mkdtempSync(
    path.join(tmpdir(), "buzz-tauri-package-assets-"),
  );
  // `frontendDist` deserializes into an untagged enum whose first variant is a
  // URL, and a Windows absolute path parses as one -- `C:` becomes the scheme.
  // Tauri then embeds zero assets, exits 0, and the app boots to
  // ERR_FILE_NOT_FOUND. Hand it a path relative to the config's own directory,
  // which can never parse as a URL. If the temp dir is on another drive there
  // is no relative form, so put the scratch root beside the config instead.
  const configDir = path.join(desktopRoot, "src-tauri");
  const relativeTo = (root) =>
    path.relative(configDir, path.join(root, "dist"));
  if (path.isAbsolute(relativeTo(invocationRoot))) {
    rmSync(invocationRoot, { recursive: true, force: true });
    invocationRoot = mkdtempSync(
      path.join(desktopRoot, ".buzz-tauri-package-assets-"),
    );
  }
  const frontendDist = path.join(invocationRoot, "dist");
  const outputOverride = JSON.stringify({
    build: { frontendDist: relativeTo(invocationRoot) },
  });

  try {
    const delimiterIndex = args.indexOf("--");
    const configIndex = delimiterIndex === -1 ? args.length : delimiterIndex;
    const tauriArgs = [...args];
    tauriArgs.splice(configIndex, 0, "--config", outputOverride);
    return runTauri(tauriArgs, {
      env: { BUZZ_PROTECTED_BUILD_OUTPUT: frontendDist },
    });
  } finally {
    rmSync(invocationRoot, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = runTauriCommand(process.argv.slice(2));
}
