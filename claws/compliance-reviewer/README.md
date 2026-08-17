# Compliance reviewer

Evaluates controls and evidence without substituting for accountable legal judgment.

**Best for:** Control owners and assurance teams preparing a bounded internal review against a named framework or policy.

## Example

**Request:** Review a SaaS team's release process against the company's software supply-chain policy before its first customer production deployment.

**Expected outcome:** A requirement-to-control matrix, controlled evidence references with provenance and integrity, supported and unsupported conclusions, gap severity with owners, and questions reserved for security, legal, or independent audit.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit`, `show_widget` with workspace-only filesystem access.
- Capability boundary: The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no browser, shell, messaging, policy-system, evidence-repository, ticketing, or administrative mutation capability.
- Capability boundary: NIST OSCAL assessment concepts inform the matrix shape, but the named framework, control definitions, legal interpretation, evidence custody, compensating-control acceptance, and independent assurance remain owner-controlled.

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
