# Operating workflow

## Start here

Ask for or confirm:

- Approved item lists, room notes, photos, receipts, warranties, serial labels, manuals, app exports, maintenance notes, purchase records, valuation notes, and owner preferences
- Item names, categories, rooms, owner labels, serial/model details, purchase dates, replacement value notes, warranty dates, condition notes, privacy labels, and evidence freshness
- Insurance-review goals, move-prep goals, warranty lookup goals, appliance and repair links, duplicate checks, high-value item handling, and stale-source fallback rules
- External actions that must remain draft-only, including claim filing, insurer contact, seller contact, uploads, sharing, disposal, sale, donation, item moves, cloud album edits, and legal/insurance conclusions

## Included capability boundaries

- The base starter uses supplied or approved item lists, photos, receipts, warranties, serial labels, manuals, app exports, maintenance notes, purchase records, valuation notes, and owner preferences and grants no insurance, legal, upload, sharing, marketplace, cloud-album, seller-contact, insurer-contact, or file-mutation authority.
- When item, receipt, photo, serial, warranty, value, condition, ownership, source, or privacy evidence is stale, partial, missing, conflicting, or sensitive, preserve the gap and ask owner-review questions rather than presenting certainty or taking action.

## Structured decision artifact contract

- Treat `fixtures/home-inventory.example.json` only as a shape example, never as current evidence or a completed result.
- Write current structured state to `outputs/home-inventory.json` and check it against `schemas/home-inventory.schema.json`.
- Resolve duplicate or dangling ids and references, preserve source and time identity, and label missing or conflicting evidence before calling the artifact ready.
- Render the reviewable handoff with `templates/home-inventory.md` at `outputs/home-inventory-binder-handoff.md`.
- Terminal approval, completion, communication, publication, or closure states may only reflect an explicit decision by the named accountable owner.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Normalize each item, room, category, owner label, serial/model fact, receipt, photo, warranty, manual, value note, and source to supplied evidence and freshness state
2. Collect receipt, photo, warranty, serial, manual, purchase, maintenance, app-export, and owner-note evidence from supplied or approved sources only
3. Reconcile stale receipts, missing serials, unsupported value notes, warranty uncertainty, duplicate item evidence, condition gaps, and valuables exposure
4. Group items by room, category, privacy risk, warranty status, evidence freshness, and owner-review need
5. Prepare a reviewable home inventory binder with evidence, gaps, privacy notes, blocked actions, and owner questions

## Example setting

**Request:** Build a home inventory binder from the receipts, photos, warranty links, and room notes I supplied. Show missing serials, warranty gaps, high-value privacy risks, and review questions, but do not file claims, upload photos, contact anyone, give insurance advice, sell or discard anything, or expose my address.

**Expected outcome:** A source-backed inventory binder with item, room, category, serial, receipt, photo, warranty, value, condition, and privacy evidence; duplicate and gap review questions; and all claim, advice, upload, contact, sale, donation, disposal, move, and address-disclosure actions blocked.

## Standard deliverables

- Item, room, and category ledger
- Receipt, photo, serial, manual, and warranty evidence register
- Value, condition, duplicate, and privacy review view
- Insurance, warranty, move, and owner-review questions
- Blocked claim, advice, upload, share, contact, sale, donation, disposal, move, and address-disclosure handoff

## Done when

- Every item, room, category, source, serial/model claim, receipt, photo, warranty, value note, and condition note has source identity, freshness, and privacy labeling
- Every inventory conclusion traces to explicit receipt, photo, warranty, manual, serial, purchase, maintenance, app-export, or owner-note evidence without hiding gaps
- Addresses, valuables, serial numbers, photos, receipts, security details, family details, and location-sensitive room data are minimized or blocked from inappropriate outputs
- Insurance claims, insurance/legal advice, uploads, insurer/seller contact, public sharing, item sale/donation/disposal/move, cloud album edits, and address disclosure remain blocked or exact-approval-bound

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
