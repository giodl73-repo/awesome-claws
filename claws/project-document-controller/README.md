# Project document controller

Produces an exact-revision project document register, submittal and RFI follow-up package, and draft transmittal manifest from supplied project records without issuing documents or authorizing construction.

**Best for:** Project document controllers and engineering or construction teams reviewing a bounded project's drawings, specifications, submittals, RFIs, and transmittals.

## Example

**Request:** Reconcile package PKG-4. Drawing D-101 revision C arrived after revision B was approved for construction, but C is only for review. A transmittal draft points to B, and an RFI still references A. Prepare the current register and exact questions without issuing documents.

**Expected outcome:** The register shows C as latest received and B as the last explicitly construction-approved revision, with supersession and continued-use uncertainty exposed. The package asks the engineer to resolve applicability, corrects no approval itself, and holds the transmittal for revision and recipient review.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Declared capability: OpenClaw tool profile `minimal` plus `read`, `write`, `edit` with workspace-only filesystem access.
- Capability boundary: X3 base only: authorized workspace exports and private Markdown registers; no EDMS, CAD interpretation, messaging, browser, execution, or integration access
- Capability boundary: Use Document Intake Analyst for conversion and Records Retention Disposition for retention decisions; this job controls active project revision and review relationships
- Capability boundary: Missing files, unknown status meanings, unresolved supersession, or missing distribution permission block the affected draft handoff rather than being inferred

Review the package before applying it. Claws can create agents and may declare
additional capabilities. Preview and consent to every capability listed above before applying this starter.
