# Notes for Claude

- **Art:** read `docs/ART-DIRECTION.md` before generating any image. The rule is modern, clean 3D (like `icons/UI/ref/`), and **no wood anywhere**.
- **The Gemini key** is never in the repo. It's a network secret on the cloud environment (host `generativelanguage.googleapis.com`, header `x-goog-api-key`), which the proxy adds to Gemini's requests, so the scripts run without it. They still use `GEMINI_API_KEY` from the environment if it's set.
