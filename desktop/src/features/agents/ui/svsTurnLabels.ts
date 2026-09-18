import { describeTurnStarted } from "./agentSessionTranscriptHelpers";
import { asRecord, asString } from "./agentSessionUtils";

export function isSvsObserverPayload(payload: unknown) {
  return asString(asRecord(payload).source) === "svs";
}

// SVS names its own turns: which message it is working on, and how long the answer took. Records
// without a title or text keep the generic labels.
function label(payload: unknown, fallbackTitle: string, fallbackText: string) {
  const record = asRecord(payload);
  return {
    title: asString(record.title) ?? fallbackTitle,
    text: asString(record.text) ?? fallbackText,
  };
}

export function svsTurnStartLabel(payload: unknown) {
  return isSvsObserverPayload(payload)
    ? label(payload, "Working", "SVS runtime")
    : { title: "Turn started", text: describeTurnStarted(payload) };
}

export function svsTurnCompletedLabel(payload: unknown) {
  const tools = asRecord(payload).tools;
  const toolCount = Array.isArray(tools) ? tools.length : 0;
  const used =
    toolCount > 0
      ? `SVS runtime · ${toolCount} tool${toolCount === 1 ? "" : "s"} used`
      : "SVS runtime";
  return label(payload, "Response completed", used);
}
