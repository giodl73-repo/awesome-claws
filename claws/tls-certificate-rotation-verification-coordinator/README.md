# TLS Certificate Rotation Verification Coordinator

Coordinates one bounded metadata-only TLS certificate rotation verification round over an exact owner-supplied predecessor certificate and service/listener/endpoint binding inventory, proving each rotate certificate was issued to a successor version, deployed, independently endpoint-validated, and exactly retired or held in approved overlap while certificate authorities and inventory owners retain all issuance, deployment, revocation, and rotation authority.

**Best for:** Authorized platform, infrastructure, security-engineering, PKI, and service owners verifying owner-supplied TLS certificate rotation metadata in a controlled workspace without exposing private keys or certificate bodies or granting issuance, deployment, or revocation execution.

## Example

**Request:** Verify this supplied predecessor TLS certificate inventory and service/listener/endpoint binding inventory for the approved rotation campaign. Record the owner's approved rotation requests, track each CA/provider issuance to a successor version, confirm successor deployment and independent endpoint fingerprint and chain observations, and show exact retirement or approved temporary overlap. Do not read private keys or certificate bodies, issue or deploy certificates, change listeners, DNS, or routes, restart, revoke, disable, or delete anything, or claim rotation completion.

**Expected outcome:** A metadata-only verification artifact partitions nine predecessor certificates into eight rotate and one excluded certificate, records one clean rotation retired after validation, one fully validated certificate held in approved temporary overlap, one pending and one failed CA issuance, one missing and one failed deployment, one endpoint fingerprint mismatch, and one chain failure, then hands the complete blocked evidence set to the approved TLS owner without claiming issuance, deployment, revocation, readiness, security, compliance, audit, or rotation completion.

## Package contents

- `CLAW.md` defines the agent and provides its portable `SOUL.md` content.
- `workspace/AGENTS.md` defines the operating workflow, deliverables, and completion criteria.
- Capability boundary: The base starter uses only supplied metadata artifacts and grants no certificate-authority, key-store, load-balancer, listener, DNS, route, browser, shell, network, MCP, plugin, cron, messaging, or ticketing capability.
- Capability boundary: Certificate authorities and inventory owners retain certificate and binding completeness, issuance authenticity, deployment execution, endpoint identity, overlap authorization, retirement and revocation, readiness, security, compliance, and audit authority.
- Capability boundary: Malformed, omitted, duplicated, stale, future, cross-certificate, unbound, self-validated, provider-borrowed, deployment-incomplete, endpoint-mismatched, or content-drifted state fails closed into exact findings and owner handoff.

Review the package before applying it. Claws can create agents and may declare
additional capabilities; this starter currently has no package, MCP, or cron dependencies.
