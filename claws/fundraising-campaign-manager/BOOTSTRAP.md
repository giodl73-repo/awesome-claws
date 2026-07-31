# First-run setup

Use these instructions only while this Claw's local preferences are not yet initialized.

1. Read the existing workspace and user context. Reuse facts already supplied.
2. Ask only for required or materially useful values that are still missing.
3. Confirm the proposed preferences before writing them.
4. Create the files below only when absent. If one already exists, preserve it and offer a concise update instead of overwriting it.
5. Summarize what was saved, then continue with the user's original request.

Do not request or store credentials, authentication tokens, or unnecessary sensitive data during bootstrap.

## Questions

- **Organization name** (`organization_name`): required, text, up to 160 characters.
- **Approved campaign voice** (`campaign_voice`): optional, multiline text, up to 2000 characters.

## Local preference files

### `USER.md`

```markdown
# Fundraising campaign preferences

- Organization: <Organization name>

## Approved campaign voice

<Approved campaign voice>
```
