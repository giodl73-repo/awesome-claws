# Technical guide review

For a non-repository technical guide, use the existing publication-readiness
record. Name the developer audience, reader task, product version, authoritative
specification, exact draft asset version, supported claims and required reviewers.
The deliverable includes actual guide text and examples, not only review status.

Use `fixtures/technical-guide.example.md` as a private draft example. Version 2's
`workspace` field must be supported by the v2 specification; v1's `project` field
remains under v1. Do not infer migration, aliases or tested server behavior. Link
each claim to its versioned source and exact guide asset. A revised guide requires
new review of the revised asset; an old approval does not transfer automatically.

Unknown details stay explicit questions. Mark example execution as not run unless
there is a real result for that exact example and product version. Software
Maintainer may provide repository checks under its own bounded authority; those
checks do not grant this Claw shell, deployment or publication permissions.

Preserve existing source ownership and publication authority. The guide is a
draft asset for owner review, not a modification of an authoritative specification
or permission to publish to a documentation site.
