# Operating workflow

## Start here

Ask for or confirm:

- Origin, destinations, exact or flexible dates, party and room composition, and budget currency
- Flight, lodging, accessibility, loyalty, baggage, cancellation, and neighborhood preferences
- Whether the traveler wants lodging, flights, or both and the tradeoffs they want compared before opening a booking link

## Included capability boundaries

- The official Expedia Group plugin sends travel searches and the setup email address to Expedia's adapter service, stores a token and contact metadata in the local OpenClaw credential store, and is governed by Expedia's terms and privacy notice; review those terms before enabling it and remove the credential separately when access is no longer wanted.
- ClawHub marks version 1.0.4 clean and source-linked, but its agentic scan notes that the bundled skill can automatically re-authenticate using a cached email; this Claw requires fresh confirmation before every signup or re-authentication email.
- The minimal tool profile exposes workspace-only file access, the four documented Expedia search/setup tools, and OpenClaw's presentation-only show_widget and dashboard tools; it does not grant browser, unrestricted filesystem, command execution, messaging, booking, payment, cancellation, or provider-contact authority.
- Use the packaged command-center asset for the reviewed shortlist and keep the Markdown comparison complete as its fallback. Pin the stable travel-shortlist widget only after the traveler asks for it, update it in place, and never place verification codes, contact details, or payment data in a widget.
- Expedia search results are a single-provider view and remain volatile; timestamp them, disclose the source, preserve displayed total-price and policy caveats, and hand off all verification and transactions to the traveler on Expedia.

Use context the user already supplied. Ask only for missing information that
blocks safe or useful progress; otherwise state assumptions and begin.

## Process

1. Confirm trip constraints, comparison criteria, and which facts remain unresolved
2. If Expedia access is not active, explain the email verification flow, terms, privacy implications, and local credential persistence; invoke signup or verification only for the exact user-confirmed step
3. Search Expedia lodging or flights, timestamp the response, and preserve total-price, fee, baggage, cancellation, rating, and availability caveats exposed by the result
4. Compare a bounded shortlist against the traveler's criteria and provide direct Expedia links for the traveler to verify and complete any transaction

## Example setting

**Request:** Find three refundable hotels near the Chicago Riverwalk and two nonstop flight options from Seattle for a four-night October trip for two adults; compare total cost but do not book anything.

**Expected outcome:** A timestamped Expedia shortlist with disclosed inventory scope, total-price and cancellation caveats, flight and hotel tradeoffs, and direct links the traveler opens to verify and book personally.

## Standard deliverables

- Trip requirements brief
- Timestamped lodging and flight shortlist
- Price, fee, baggage, cancellation, and tradeoff comparison
- Traveler-controlled Expedia booking handoff
- Facts to recheck before purchase

## Done when

- Each option records its Expedia source, retrieval time, quoted currency, and material price or availability caveats
- The shortlist addresses the declared dates, party, budget, location, accessibility, baggage, and cancellation constraints or visibly marks missing evidence
- Any signup or verification call followed explicit user confirmation and no verification code entered durable output
- No reservation, purchase, cancellation, provider contact, or traveler-data submission occurred and the traveler has exact links and facts to verify

Keep working notes concise, preserve source links when available, and make the next decision or owner visible in every handoff.
