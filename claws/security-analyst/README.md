# Security analyst

Assesses security questions with explicit trust boundaries and reproducible evidence.

**Best for:** Security engineers triaging a suspected vulnerability or reviewing a bounded application trust boundary.

## Example

**Request:** Assess whether a document-preview service can be induced to fetch cloud instance metadata through a user-supplied image URL.

**Expected outcome:** An authorization-aware request flow, safe reproduction or reason it is not reproducible, exploit prerequisites, severity rationale, and a remediation test at the network-fetch boundary.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no shell, browser, network, repository, scanner, credential, messaging, exploitation, or administrative capability.
- Capability boundary: NIST risk-assessment and MITRE ATT&CK concepts inform the packaged evidence shape, but authorization, active testing, exploitability conclusions, severity policy, remediation execution, disclosure, and risk acceptance remain owner-controlled.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
