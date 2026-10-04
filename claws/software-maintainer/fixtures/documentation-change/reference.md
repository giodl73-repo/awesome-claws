# Jobs API request fields

| Version | Endpoint | Required fields | Rejected legacy or future field |
| --- | --- | --- | --- |
| v1 | POST /v1/jobs | project, name | workspace |
| v2 | POST /v2/jobs | workspace, name | project |

All required fields are nonempty strings. Additional request fields are not
accepted under the supplied specifications. No backward-compatible alias is
specified. This reference describes request shape, not a successful server call.

Return to [Create a job](guide.md).
