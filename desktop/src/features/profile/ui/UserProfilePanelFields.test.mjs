import assert from "node:assert/strict";
import test from "node:test";

import { buildOwnerFields } from "./UserProfilePanelFields.tsx";

function managedAgent(overrides = {}) {
  return {
    status: "stopped",
    agentCommand: "codex-acp",
    acpCommand: "codex-acp",
    mcpCommand: "",
    backend: { type: "local" },
    startOnAppLaunch: false,
    envVars: {},
    respondTo: "owner-only",
    lastError: null,
    ...overrides,
  };
}

test("SVS-managed agents show their external manager instead of Buzz stopped state", () => {
  const fields = buildOwnerFields({
    includeOperationalFields: true,
    managedAgent: managedAgent({ envVars: { SVS_MANAGED: "1" } }),
    onOpenProfile: undefined,
    ownerDisplayName: "Faisal",
    ownerHandle: null,
    ownerProfilePubkey: null,
    ownerPubkey: null,
    presenceLoaded: true,
    presenceStatus: "offline",
    relayAgent: undefined,
  });

  assert.equal(
    fields.find((field) => field.label === "Status")?.displayValue,
    "Managed by SVS",
  );
  assert.equal(
    fields.some((field) => field.label === "Start on launch"),
    false,
  );
});

test("normal managed agents retain Buzz runtime controls", () => {
  const fields = buildOwnerFields({
    includeOperationalFields: true,
    managedAgent: managedAgent(),
    onOpenProfile: undefined,
    ownerDisplayName: "Faisal",
    ownerHandle: null,
    ownerProfilePubkey: null,
    ownerPubkey: null,
    presenceLoaded: true,
    presenceStatus: "offline",
    relayAgent: undefined,
  });

  assert.equal(
    fields.find((field) => field.label === "Status")?.displayValue,
    "Stopped",
  );
  assert.equal(
    fields.some((field) => field.label === "Start on launch"),
    true,
  );
});
