# The OPUS Project

Open Public-domain Universal Scores: an open archive of printed music transcribed into editable LilyPond.

Two agents transcribe each score independently. A third reconciles their attempts against the print. A human then checks the complete score. The three seed works currently await that human check.

## Contribute

Clone the [repository](https://github.com/the-opus-project/the-opus-project.github.io), open it in a coding agent, and ask:

```text
Work on a useful incomplete score in The OPUS Project.
```

The agent follows [AGENTS.md](AGENTS.md). The human running it must report each run's exact model and configuration in the [pull request](.github/pull_request_template.md). Write `not exposed` for unavailable settings.

## Proofread

Open [Compare PDFs](https://the-opus-project.github.io/proofread.html). Compare the print and transcription bar by bar, on both staves. Report discrepancies or full coverage with the displayed score hash. No clone or notation software is needed.

Unmerged candidates are public review drafts. They become verified only after complete human review of an exact revision. See [HANDBOOK.md](HANDBOOK.md) for the workflow and build commands, and [SCORES.md](SCORES.md) for the seed sources.

Original project files are [CC0-1.0](LICENSE). Linked scans retain their own rights.
