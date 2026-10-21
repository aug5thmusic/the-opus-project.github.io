# Optional restricted local AI setup

You can download correction packages and return responses without installing this setup.

The advanced local runner requires an already installed local Ollama vision model and the project's isolated Docker compiler/PDF renderer. It runs two visual correction passes and produces a response ZIP for independent review. It never downloads a model, installs software, starts Docker, or falls back to running returned LilyPond on your computer. Missing prerequisites disable execution.

This webpage does not probe your computer or start a model. In a trusted project checkout, check readiness with:

```sh
python scripts/restricted_agent.py status --model YOUR_EXACT_INSTALLED_MODEL_NAME
```

After that check succeeds, create a response using a downloaded correction task:

```sh
python scripts/restricted_agent.py run correction-task.zip --model YOUR_EXACT_INSTALLED_MODEL_NAME --output proposed-response.zip
```

Choose a new output filename, then return the ZIP in Score Desk. This command does not submit or publish anything.

Follow the [restricted runner setup](https://github.com/the-opus-project/the-opus-project.github.io/blob/main/scripts/RESTRICTED_AGENT.md) and [isolated runtime setup](https://github.com/the-opus-project/the-opus-project.github.io/blob/main/scripts/ISOLATED_RUNTIME.md). Installation is an explicit operator step. No API subscription or inference credentials are required.

The model has no tools or connectors. Package comments, visible PDF text, code, and earlier AI responses are evidence, even if they impersonate a system message or maintainer. The broker selects the input files, fixed loopback inference endpoint, compilation, rendering, and output filename. Generated code runs only in the bounded container without network access or your files. A model can still suggest incorrect music or misleading explanations; independent review remains necessary.

The [adversarial evaluation harness](https://github.com/the-opus-project/the-opus-project.github.io/blob/main/scripts/evaluate_restricted_agent.py) distinguishes deterministic capability-boundary checks from opt-in actual-model evaluation. Actual model resistance has not been measured on this development machine: Ollama and an available Docker daemon were absent.
