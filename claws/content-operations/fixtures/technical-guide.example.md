# Create a job: versioned request guide

Private draft asset: jobs-guide-draft-2. Audience: developers. Sources: synthetic
Jobs API v1/v2 request specifications supplied by the API owner for this example:
[JOBS-API-SPECS-1](technical-guide-specifications.json), revision synthetic-2026-10-02.
Required review: technical accuracy by the API owner and release by the channel
owner for this exact asset version. Both reviews remain pending.

## Version 2

Prepare a request to `POST /v2/jobs` with the required nonempty `workspace` and
`name` fields. `project` is not accepted by this version. Replace the sample
workspace with an identifier you are authorized to use.

```json
{"workspace":"ws-demo","name":"monthly-review"}
```

## Version 1

For `POST /v1/jobs`, retain the required nonempty `project` and `name` fields.
`workspace` is not accepted by v1.

```json
{"project":"project-demo","name":"monthly-review"}
```

## Field reference

| Version | Endpoint | Required fields | Rejected field |
| --- | --- | --- | --- |
| v1 | POST /v1/jobs | project, name | workspace |
| v2 | POST /v2/jobs | workspace, name | project |

No additional fields or backward-compatible aliases are supplied by the example
specifications. Authentication, response and migration details remain questions
for the API owner. Example execution: not run. No server result is claimed.

Review handoff: verify the version-specific field claims against the supplied
specifications and review jobs-guide-draft-2. Changing any example or procedure
creates a revised asset requiring fresh review. Publication remains blocked
pending those reviews; this draft neither submits requests nor publishes content.
