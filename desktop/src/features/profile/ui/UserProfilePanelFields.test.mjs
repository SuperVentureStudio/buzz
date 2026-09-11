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

test("SVS-managed agents with an actor id link to their SVS profile", () => {
  const fields = buildOwnerFields({
    includeOperationalFields: false,
    managedAgent: managedAgent({
      envVars: { SVS_MANAGED: "1", SVS_ACTOR_ID: "actor:maya" },
    }),
    onOpenProfile: undefined,
    ownerDisplayName: "Faisal",
    ownerHandle: null,
    ownerProfilePubkey: null,
    ownerPubkey: null,
    presenceLoaded: true,
    presenceStatus: "offline",
    relayAgent: undefined,
  });

  const link = fields.find((field) => field.label === "SVS profile");
  assert.equal(
    link?.copyValue,
    "http://localhost:5173/team/agents/actor%3Amaya",
  );
  assert.equal(typeof link?.onClick, "function");
});

test("agents without an SVS actor id get no SVS profile link", () => {
  for (const envVars of [
    { SVS_MANAGED: "1" },
    { SVS_ACTOR_ID: "actor:maya" },
  ]) {
    const fields = buildOwnerFields({
      includeOperationalFields: true,
      managedAgent: managedAgent({ envVars }),
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
      fields.some((field) => field.label === "SVS profile"),
      false,
    );
  }
});
