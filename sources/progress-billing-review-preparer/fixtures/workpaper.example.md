# Private owner workpaper

Destination: private/owner-review; as of 2026-10-05T18:00:00Z.

Input digest: sha256:b0a34e4440b62ac0da2cd15120977109a69676fa2a1dd48d17a806b14ea243af. State: ready-for-owner-review.

## Stored lot conservation

- LOT-A (A): 10000 + 0 - 5000 - 0 = 5000; transfer evidence installed-A-transfer:5000; eligibility owner-eligibility-A.

## Retainage instructions

- A: installed x 0.10; stored x 0.10; half-up-per-component to 2 digits; rule owner-rules-A-r1; negative adjustment none.

- B: installed x 0.05; stored x 0.05; half-up-per-component to 2 digits; rule owner-rules-B-r1; negative adjustment none.

## Certification history

Mode: cumulative-snapshot. Cumulative snapshots are never summed. Explicit approved supersession replaces only the identified record; all history is retained.

- cert-A-1: period 1, cumulative-snapshot, 9000; replaces none; authority none.

- cert-B-1: period 1, cumulative-snapshot, 19000; replaces none; authority none.

- cert-A-2: period 2, cumulative-snapshot, 27000; replaces none; authority none.

- cert-B-2: period 2, cumulative-snapshot, 47500; replaces none; authority none.

- A: entitlement 36000.00 - prior certified 27000.00 = 9000.00; selected cert-A-2; prior unpaid 7000.00.

- B: entitlement 57000.00 - prior certified 47500.00 = 9500.00; selected cert-B-2; prior unpaid 0.00.

## Changes

- change-approved (A): 10000, approved; approval owner-change-1.

- change-pending (A): 7000, pending; approval none.

## Cash (never certification)

- cash-A (A): 20000; 2026-10-03T12:00:00Z; applied-to-prior-certificates through period 2; owner confirmed true; application owner-cash-application-A.

- cash-B (B): 47500; 2026-10-03T12:00:00Z; applied-to-prior-certificates through period 2; owner confirmed true; application owner-cash-application-B.

## Supplied checklist

- backup-checklist: required r1, supplied r1; disclosure permitted true.

## Owner questions

Review this exact revision and input digest. No input blockers remain; this is not approval to submit.

## Exact source-bound input

The JSON report preserves every application, native record, revision, movement and owner declaration. The following private snapshot is part of this workpaper:

<pre>{
  "schemaVersion": "awesomeClaws.progressBillingInput.v1",
  "scope": {
    "contract": "Contract-Alias",
    "application": "APP-3",
    "revision": "r1",
    "period": 3,
    "periodStart": "2026-10-01",
    "periodEnd": "2026-10-05",
    "asOf": "2026-10-05T18:00:00Z",
    "currency": "USD",
    "minorDigits": 2,
    "reviewer": "Owner billing reviewer",
    "privateDestination": "private/owner-review"
  },
  "coverage": {
    "id": "coverage",
    "sourceRef": "owner-pack",
    "sourceRevision": "r1",
    "nativeId": "coverage",
    "lines": [
      "A",
      "B"
    ],
    "lots": [
      "LOT-A"
    ],
    "complete": true,
    "historyComplete": true,
    "cashComplete": true,
    "checklistComplete": true,
    "rulesComplete": true,
    "noDuplicateCoverage": true,
    "disclosureApproved": true,
    "unresolvedCorrections": []
  },
  "sources": [
    {
      "id": "owner-pack",
      "revision": "r1",
      "currentRevision": "r1",
      "contract": "Contract-Alias",
      "capturedAt": "2026-10-05T17:00:00Z",
      "approved": true
    }
  ],
  "periods": [
    {
      "id": "period-1",
      "sourceRef": "owner-pack",
      "sourceRevision": "r1",
      "nativeId": "period-1",
      "number": 1,
      "start": "2026-08-01",
      "end": "2026-08-31",
      "applicationRevision": "r1"
    },
    {
      "id": "period-2",
      "sourceRef": "owner-pack",
      "sourceRevision": "r1",
      "nativeId": "period-2",
      "number": 2,
      "start": "2026-09-01",
      "end": "2026-09-30",
      "applicationRevision": "r1"
    },
    {
      "id": "period-3",
      "sourceRef": "owner-pack",
      "sourceRevision": "r1",
      "nativeId": "period-3",
      "number": 3,
      "start": "2026-10-01",
      "end": "2026-10-05",
      "applicationRevision": "r1"
    }
  ],
  "lines": [
    {
      "id": "A",
      "sourceRef": "owner-pack",
      "sourceRevision": "r1",
      "nativeId": "A",
      "baseScheduled": "100000",
      "installedOpening": "20000",
      "installedClosing": "35000",
      "storedOpening": "10000",
      "storedClosing": "5000",
      "workedRate": "0.10",
      "storedRate": "0.10",
      "rounding": "half-up-per-component",
      "rulesRef": "owner-rules-A-r1",
      "negativeAdjustmentRef": null
    },
    {
      "id": "B",
      "sourceRef": "owner-pack",
      "sourceRevision": "r1",
      "nativeId": "B",
      "baseScheduled": "100000",
      "installedOpening": "50000",
      "installedClosing": "60000",
      "storedOpening": "0",
      "storedClosing": "0",
      "workedRate": "0.05",
      "storedRate": "0.05",
      "rounding": "half-up-per-component",
      "rulesRef": "owner-rules-B-r1",
      "negativeAdjustmentRef": null
    }
  ],
  "changes": [
    {
      "id": "change-approved",
      "sourceRef": "owner-pack",
      "sourceRevision": "r1",
      "nativeId": "change-approved",
      "line": "A",
      "amount": "10000",
      "state": "approved",
      "approvalRef": "owner-change-1"
    },
    {
      "id": "change-pending",
      "sourceRef": "owner-pack",
      "sourceRevision": "r1",
      "nativeId": "change-pending",
      "line": "A",
      "amount": "7000",
      "state": "pending",
      "approvalRef": null
    }
  ],
  "installed": [
    {
      "id": "installed-A-new",
      "sourceRef": "owner-pack",
      "sourceRevision": "r1",
      "nativeId": "installed-A-new",
      "line": "A",
      "kind": "new-work",
      "amount": "10000",
      "authorizationRef": "owner-progress-A"
    },
    {
      "id": "installed-A-transfer",
      "sourceRef": "owner-pack",
      "sourceRevision": "r1",
      "nativeId": "installed-A-transfer",
      "line": "A",
      "kind": "stored-transfer",
      "amount": "5000",
      "authorizationRef": "owner-install-LOT-A"
    },
    {
      "id": "installed-B-new",
      "sourceRef": "owner-pack",
      "sourceRevision": "r1",
      "nativeId": "installed-B-new",
      "line": "B",
      "kind": "new-work",
      "amount": "10000",
      "authorizationRef": "owner-progress-B"
    }
  ],
  "lots": [
    {
      "id": "LOT-A",
      "sourceRef": "owner-pack",
      "sourceRevision": "r1",
      "nativeId": "LOT-A",
      "line": "A",
      "opening": "10000",
      "additions": "0",
      "removals": "0",
      "closing": "5000",
      "eligible": true,
      "eligibilityRef": "owner-eligibility-A",
      "movementRef": "owner-lot-ledger-r1",
      "transfers": [
        {
          "installedRef": "installed-A-transfer",
          "amount": "5000"
        }
      ]
    }
  ],
  "history": {
    "mode": "cumulative-snapshot",
    "applications": [
      {
        "id": "app-A-1",
        "sourceRef": "owner-pack",
        "sourceRevision": "r1",
        "nativeId": "app-A-1",
        "line": "A",
        "period": 1,
        "applicationRevision": "r1",
        "installed": "10000",
        "stored": "0"
      },
      {
        "id": "app-B-1",
        "sourceRef": "owner-pack",
        "sourceRevision": "r1",
        "nativeId": "app-B-1",
        "line": "B",
        "period": 1,
        "applicationRevision": "r1",
        "installed": "20000",
        "stored": "0"
      },
      {
        "id": "app-A-2",
        "sourceRef": "owner-pack",
        "sourceRevision": "r1",
        "nativeId": "app-A-2",
        "line": "A",
        "period": 2,
        "applicationRevision": "r1",
        "installed": "20000",
        "stored": "10000"
      },
      {
        "id": "app-B-2",
        "sourceRef": "owner-pack",
        "sourceRevision": "r1",
        "nativeId": "app-B-2",
        "line": "B",
        "period": 2,
        "applicationRevision": "r1",
        "installed": "50000",
        "stored": "0"
      }
    ],
    "certificates": [
      {
        "id": "cert-A-1",
        "sourceRef": "owner-pack",
        "sourceRevision": "r1",
        "nativeId": "cert-A-1",
        "line": "A",
        "period": 1,
        "applicationRevision": "r1",
        "kind": "cumulative-snapshot",
        "amount": "9000",
        "supersedes": null,
        "replacementApprovalRef": null,
        "correctionResolved": true
      },
      {
        "id": "cert-B-1",
        "sourceRef": "owner-pack",
        "sourceRevision": "r1",
        "nativeId": "cert-B-1",
        "line": "B",
        "period": 1,
        "applicationRevision": "r1",
        "kind": "cumulative-snapshot",
        "amount": "19000",
        "supersedes": null,
        "replacementApprovalRef": null,
        "correctionResolved": true
      },
      {
        "id": "cert-A-2",
        "sourceRef": "owner-pack",
        "sourceRevision": "r1",
        "nativeId": "cert-A-2",
        "line": "A",
        "period": 2,
        "applicationRevision": "r1",
        "kind": "cumulative-snapshot",
        "amount": "27000",
        "supersedes": null,
        "replacementApprovalRef": null,
        "correctionResolved": true
      },
      {
        "id": "cert-B-2",
        "sourceRef": "owner-pack",
        "sourceRevision": "r1",
        "nativeId": "cert-B-2",
        "line": "B",
        "period": 2,
        "applicationRevision": "r1",
        "kind": "cumulative-snapshot",
        "amount": "47500",
        "supersedes": null,
        "replacementApprovalRef": null,
        "correctionResolved": true
      }
    ]
  },
  "cash": [
    {
      "id": "cash-A",
      "sourceRef": "owner-pack",
      "sourceRevision": "r1",
      "nativeId": "cash-A",
      "line": "A",
      "amount": "20000",
      "at": "2026-10-03T12:00:00Z",
      "basis": "applied-to-prior-certificates",
      "throughPeriod": 2,
      "ownerConfirmed": true,
      "applicationRef": "owner-cash-application-A"
    },
    {
      "id": "cash-B",
      "sourceRef": "owner-pack",
      "sourceRevision": "r1",
      "nativeId": "cash-B",
      "line": "B",
      "amount": "47500",
      "at": "2026-10-03T12:00:00Z",
      "basis": "applied-to-prior-certificates",
      "throughPeriod": 2,
      "ownerConfirmed": true,
      "applicationRef": "owner-cash-application-B"
    }
  ],
  "attachments": [
    {
      "id": "backup-checklist",
      "sourceRef": "owner-pack",
      "sourceRevision": "r1",
      "nativeId": "backup-checklist",
      "requiredRevision": "r1",
      "suppliedRevision": "r1",
      "permitted": true
    }
  ]
}</pre>

Synthetic fixtures are deterministic validation examples, not observed project evidence or human approval. No external action was performed.
