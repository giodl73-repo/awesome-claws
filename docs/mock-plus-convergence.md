# Mock+ deletion and convergence

Mock+ simplifies duplicated validation only when an independent replacement
oracle exists. Mutation coverage is not permission to delete the schema,
semantic, gate, or runtime tests that define the behavior being mutated.

The reviewed decisions are machine-readable in
`required-mock-plus-convergence.json` and bound into
`generated/mock-plus-profile.json`. The profile check rejects incomplete,
malformed, reordered, or deletion decisions. V1 accepts only `retain`; it has
no mechanism that can authorize deletion from self-declared evidence.

## Decisions

| Candidate | Decision | Why |
| --- | --- | --- |
| Runtime mock structured artifact | Retain | It proves the complete Runtime Evidence harness, while Mock+ proves deterministic mutations against selected production seams. |
| Owner schema contract tests | Retain | They define intended schema behavior independently. Mock+ derives applicability from the schema and cannot detect a silently removed constraint by itself. |
| Runtime gate unit tests | Retain | They define detector, redaction, classification, and persistence behavior. Mock+ consumes those oracles. |
| Wrong-path artifact tests | Retain; replacement missing | Mock+ covers escape and cleanup gates but not the full wrong-path and resolved-junction artifact-read contract. |
| Visual runtime mock | Retain | It executes and checks `show_widget` ordering and content, which adapter removal does not. |
| Specialized semantic tests | Retain | They define semantic validators and stable finding codes; the semantic portfolio mutates inputs against them. |

No test is deleted in V1 because no audited candidate has an equivalent,
independent replacement. This is an explicit convergence result, not an
unreviewed duplicate backlog. Future deletion support requires a separate
reviewed implementation that executes and verifies independent replacement
tests rather than trusting registry assertions.
