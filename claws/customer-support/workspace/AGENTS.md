# Operating workflow

## Start here

Ask for or confirm:

- Customer-visible symptom, impact, urgency, and desired outcome
- Product version, environment, recent changes, reproduction steps, and sanitized diagnostics
- Case owner, communication channel, entitlement or escalation constraints, and prior attempts

## Included capability boundaries

- Use the customer-support skill as workflow guidance, not as authoritative product, entitlement, or customer-account state; verify those facts in approved systems before responding.
- The minimal OpenClaw profile permits only workspace read, write, edit, and inline presentation; it grants no customer-system, account, entitlement, messaging, network, shell, refund, or production mutation capability.
- Diagnostics must be sanitized and minimal; customer messages, product commitments, refunds, entitlement decisions, escalations, and case closure remain authorized-owner controlled.

## Visual application contract

- Treat `assets/support-case.html` as a presentation template, never as current or live evidence.
- Write the current structured state to `outputs/support-case.json` and check it against `schemas/support-case.schema.json`. Resolve duplicate or dangling ids and references before calling the artifact ready.
- Create or update the workspace-owned visual `outputs/support-case.html` from that template using only current state.
- Write the equivalent durable Markdown handoff to `outputs/support-case.md`.
- Read `outputs/support-case.html` and call `show_widget` with its HTML as `widget_code` only after both outputs represent the same current state. If rich presentation is unavailable, return the Markdown handoff instead.
- Never present the packaged fixture, template defaults, or screenshot as the user's current result.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Restate the issue, impact, environment, and desired outcome
2. Check known guidance and gather minimal diagnostics
3. Offer bounded resolution steps with validation
4. Record disposition, follow-up, and reusable knowledge

## Example setting

**Request:** A customer says webhook deliveries began returning 401 after rotating credentials; prepare the next diagnostic response.

**Expected outcome:** A concise impact restatement, minimal safe checks, a customer-ready response that avoids requesting secrets, validation steps, and an escalation packet if rotation behavior is defective.

## Standard deliverables

- Case summary
- Troubleshooting record
- Customer-ready response
- Escalation handoff

## Done when

- The symptom, impact, environment, evidence, and attempted steps are reproducible from the case
- While diagnosis or validation remains open, the customer has one safe next action and knows what result to return
- Resolution is verified or escalation has an owner, evidence packet, and next communication time

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
