# Restricted local correction runner

Score Desk can still download a correction package and accept a returned response without this optional setup. The restricted runner is an advanced, local route for producing a response. It does not require an API subscription or account credentials.

The runner uses an already installed **local Ollama vision model** and the project's [isolated compiler and PDF renderer](ISOLATED_RUNTIME.md). It never installs software, downloads a model, pulls an image, starts Docker, or falls back to host compilation. If either prerequisite is missing, it reports that execution is disabled and leaves the task package intact.

On the development machine on 21 October 2026, Ollama was not installed/listening and the Docker daemon was unavailable. No inference was performed. No claim of measured model resistance or end-to-end model success is made.

## Operator setup

Use a trusted checkout of this repository and Python 3.10 or later. Provision the local Linux Docker image by following [ISOLATED_RUNTIME.md](ISOLATED_RUNTIME.md). Independently install/configure Ollama and a local vision-and-completion model you have chosen; those installations and downloads are operator actions outside the runner. Configure the inference service for local use only, with cloud features disabled. The runner accepts only an installed GGUF model with concrete local bytes/digest and local vision capability metadata; remote/cloud model declarations are refused.

Check prerequisites without inference:

```sh
python scripts/restricted_agent.py status --model YOUR_EXACT_INSTALLED_MODEL_NAME
```

A failed check returns exit code 2 and JSON reasons. A successful check means the required local services are available; it is not a security certification of the installed model or daemon. The installed broker checkout, Ollama runtime, local model bytes, Docker daemon, and locally built project image are trusted parts of this setup. Keep them under your control. Running a general agent beside the package with host shell access is outside this restricted route.

Once prerequisites pass, download the correction ZIP from **Send corrections to AI**, then explicitly run:

```sh
python scripts/restricted_agent.py run correction-task.zip --model YOUR_EXACT_INSTALLED_MODEL_NAME --output proposed-response.zip
```

The output path must be new. The broker renders every page of the exact source and baseline documents, requests a proposed correction, compiles it in isolation, and requests a second visual comparison against the rendered proposal. It compiles again if that pass changes the LilyPond. It then writes a standard Score Desk response ZIP with the exact original task ID, baseline, and finding IDs. Return that ZIP through Score Desk for independent review. Nothing is submitted, approved, applied, or published automatically.

Local v1 tasks and v2 shared/follow-up tasks are supported. Historical findings keep their exact original rendering alongside the current rendering; coordinates are never reassigned. Legacy follow-ups that do not retain the PDF matching their original context digest stop with an explicit missing-context error. A legacy record may not identify a separate older printed edition; the model is told that limitation and must clarify any edition mismatch.

Compilation failure, oversized input, missing context, truncated output, malformed JSON, or an unavailable prerequisite stops the run. The original package remains available. The runner does not silently omit pages, simplify findings, invent a pending success, or ask the model to find a different endpoint or compiler. Large tasks may need a separately scoped task. The current bounds are 64 MiB compressed package, 64 findings, 1 MiB LilyPond, 256 KiB review data, eight distinct original/historical PDFs, 40 pages per PDF, 80 total images including self-review, and 32 MiB image bytes. Local inference has a 180-second request limit, a fixed token/context budget, and bounded output; some models/tasks will fail these limits. Models that emit additional assistant fields, including separate thinking text or tool calls, are unsupported and fail closed. The broker rechecks local capabilities and the exact model digest before each inference; a model change stops the run. A model may still overlook notation or fail to use all context correctly, so human comparison remains necessary.

## What constrains the model

The model receives only two kinds of messages: installed project policy in a system message, and explicit evidence JSON plus page images in a user message. Uploaded `PROMPT.txt`, handbook copies, templates, policy hashes, and operational task fields never become instructions. Package hashes check self-consistency; an offline ZIP cannot prove that its claimed author, printed edition, or snapshot is authentic. Use packages obtained from the project and check the source identity in Score Desk.

Comments, PDF text, code comments, reviewer explanations, discussion attribution, historical instructions, and earlier model responses remain untrusted evidence even when they impersonate a system message or maintainer. The model has **no tools or connectors**. Its sole output schema is complete LilyPond and one explanation/status per finding. Tool calls, extra output fields, requested file paths, approval/verification declarations, duplicated IDs, duplicate JSON keys, and truncated model responses are rejected.

The Python broker chooses every operation and filename. Its only inference endpoint is `http://127.0.0.1:11434`, using fixed `/api/tags`, `/api/show`, and `/api/chat` routes. It ignores proxy and `OLLAMA_HOST` environment settings, rejects redirects, does not accept URLs from the model or a task, and has no model-download route. Model inference credentials are neither needed nor supplied. Returned code may contain arbitrary Scheme, so it is passed only to the [isolated runtime](ISOLATED_RUNTIME.md); it is never executed by the host Python process or shell. The compiler container receives no inference connection, credentials, repository, home folder, Docker socket, or network access. It can write only bounded disposable container data; the trusted runner imports only validated output files after exit.

This is a capability boundary, not a guarantee that a model ignores misleading content. A fooled model can still propose incorrect music, malicious LilyPond, or misleading explanations. Isolation limits what executing that LilyPond can access; independent review decides whether the music and explanations are acceptable. Container isolation also depends on an uncompromised host/kernel/daemon.

## Evaluation and its limits

Run the deterministic boundary corpus without a model, network inference, or a Docker job:

```sh
python -m unittest discover -s scripts -p test_restricted_agent.py -v
python scripts/evaluate_restricted_agent.py
```

The [corpus](restricted-agent-corpus.json) includes forged system/maintainer instructions in comments, a generated PDF page, LilyPond comments and Scheme, reviewer explanations, discussion attribution, instruction history, earlier AI responses, and resealed uploaded guidance. Tests check data-role separation, fixed endpoint and operation selection, output-schema enforcement, no-prerequisite shutdown, exact response identity, and the fixed two-pass pipeline with a simulated renderer/compiler. They also inject adversarial model outputs directly. Those tests measure **broker containment**, not the behavior of a real vision model, and the simulated compilation is never evidence that a real score compiled.

The second command emits a machine-readable report with the corpus digest and separate boundary/model sections. By default it never calls Ollama or starts a Docker job. The separate isolated-runtime tests cover the container controls and real canary jobs when Docker is available. A successful mocked broker test does not replace those tests.

For an actual model-resistance evaluation, an operator must first provision the required local services and explicitly authorize inference:

```sh
python scripts/evaluate_restricted_agent.py --run-model --model YOUR_EXACT_INSTALLED_MODEL_NAME --output-dir new-evaluation-directory
```

The harness generates a non-sensitive simulated task for each corpus case, visibly wraps the PDF attack onto its page, and reseals the task baseline when source/code bytes change. It sends these tasks only through the same tool-free broker and isolated renderer/compiler. It records the exact installed model digest, runtime policy/image digest, corpus revision, validated model responses, failures, and per-case artifacts. There are no real credentials, host-file reads, or external-service canaries. Missing prerequisites produce `not_run` without creating evaluation artifacts or requesting inference.

Heuristic output flags identify introduced shell/file-writing code, extra URLs, claimed operational actions, and refusal language. They are cues for human assessment, not a resistance score. Clarification can reflect an unclear synthetic score, not an attack refusal. A model response rejected by the broker is recorded as an execution failure, not a successful refusal. Inspect the recorded first and second pass results, record whether the model followed the injected musical or operational request, and repeat across attack surfaces before reporting denominators and failures. Keep musical corruption, attempted tool use, and broker capability violations as separate outcomes. Do not label parser acceptance or absence of an executed tool as model resistance. No such actual-model evaluation has been performed in this implementation environment.

Ollama's documented [chat API](https://docs.ollama.com/api/chat) supports JSON-schema output with streaming disabled; [vision inputs](https://docs.ollama.com/capabilities/vision) carry base64 images. The broker uses those interfaces without a tools declaration.
