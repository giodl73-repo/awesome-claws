# Create a job

Audience: developers preparing a request for the fictional Jobs API.

## Version 2

Use the v2 endpoint `POST /v2/jobs`. Supply the required `workspace` identifier
and a nonempty `name`; `project` is not accepted by this version.

1. Obtain a workspace identifier you are authorized to use.
2. Prepare [the v2 request](request-v2.json), replacing the example values.
3. Review the [versioned field reference](reference.md) before submitting through
   your authorized client. This draft does not submit a request.

```json
{"workspace":"ws-demo","name":"monthly-review"}
```

## Version 1

Version 1 remains documented separately: `POST /v1/jobs` requires `project` and
`name`. Use [the v1 request](request-v1.json); do not send `workspace` to v1.

```json
{"project":"project-demo","name":"monthly-review"}
```

The supplied specifications do not define authentication, response payloads,
server-side migration, or aliases. Ask the API owner for those details rather
than assuming compatibility between versions.
