# CLAUDE.md

How to work in this repository. Read this before changing anything.

## Start here

1. **[docs/PROJECT_MAP.md](docs/PROJECT_MAP.md)**: every API route, backend function and frontend file, with one
   line on what each does. Look things up here before searching the code.
2. [docs/PRD.md](docs/PRD.md) (what and why), [docs/TRD.md](docs/TRD.md) (how), [docs/DESIGN.md](docs/DESIGN.md)
   (how it looks), [docs/DEPLOY.md](docs/DEPLOY.md) (the server).

After changing backend code, regenerate the map: `cd backend && python -m scripts.project_map`.

## Ask first

Stop and ask before you:

- change a MongoEngine model (fields, collection names) or the keys stored in a graph's state. Saved data must keep
  working;
- change an AI model or its default (`MODEL`, `EMBEDDING_MODEL`, the speech and transcription models, voices);
- change what a prompt asks for, or any scoring, routing or schedule rule;
- add or upgrade a dependency (backend or frontend);
- change anything in `deploy/`, or anything that deletes data.

## Stack

- **Backend:** Flask with an app factory (`create_app()` in `app.py`) and one blueprint per file in `routes/`,
  all under `/api`. gunicorn in production. Python 3.12.
- **Data:** MongoDB through MongoEngine models in `models/` (one document class per collection, with a
  `find_x(id)` helper). LangGraph state is saved by `MongoDBSaver`. Document vectors in Chroma.
- **AI:** LangChain + LangGraph. The chat model comes only from `services/llm.py` `get_model()` (set by `MODEL`,
  default `openai:gpt-6-luna`); embeddings from `get_embeddings()` (`openai:text-embedding-3-small`). Speech
  (`gpt-4o-mini-tts`) and transcription (`gpt-transcribe`) only in `services/voice.py`. Don't create model
  clients anywhere else.
- **Frontend:** React 19 + Vite, plain JavaScript (no TypeScript), Oxlint.

## Backend rules

- **Routes do HTTP only:** read and check the request, call a service, return JSON. Errors are
  `{"error": "..."}` with 400 (bad input), 404 (not found), 409 (already finished) or 503 (AI unavailable).
- **Logic lives in `services/`.** A feature with an AI flow gets a folder with `prompts.py`, `schemas.py`,
  `state.py`, `nodes.py` and `graph.py`, like `services/interview/` and `services/panel/`.
- **AI calls** use structured output (a Pydantic class in `schemas.py`). Scores, routing and decisions are
  computed by code, never by the model: the model quotes, code checks the quote. User text (answers, resumes,
  JDs) is wrapped in tags and the prompt says to ignore instructions inside it.
- **LangGraph:** the thread id is the document's id; nothing with side effects before `interrupt()`; parallel
  steps write to add-reducer lists.
- **Easy to read, always:**
  - plain `for` loops and named helper functions;
  - no lambdas, nested functions, comprehensions with conditions, or `**` unpacking;
  - every function has a docstring saying what it does in plain words (the project map is built from them);
    Pydantic schema classes get a comment line above instead;
  - simple names, no abbreviations; constants at the top of the file with a comment.

## Frontend rules

- Every backend call goes through `src/lib/api.js`.
- Colours, radii and shadows only through the tokens in `src/styles/tokens.css`; check light and dark.
- One stylesheet per area in `src/styles/`, imported from `index.css`.
- A comment above each component: what it shows, and its props.
- Keyboard and screen-reader friendly; respect reduced motion.

## Commands

```bash
# backend (from backend/, with .venv active)
python app.py                      # API on :5001
pytest                             # tests: fake AI, needs MongoDB (TEST_MONGO_URI)
ruff check .                       # lint
python -m scripts.project_map      # rebuild docs/PROJECT_MAP.md
python -m evals.run                # evals against the real model: costs money, ask first

# frontend (from frontend/)
npm run dev                        # :5173, proxies /api to :5001
npm run lint && npm run build
```

## Deploying

A push to `main` deploys to the live server once the checks pass (`.github/workflows/ci.yml`). Run the checks
locally first, and never push to `main` unless asked.

## Tests

- Add or update a test in `backend/tests/` for every new route or rule.
- Tests use the fakes in `tests/fakes.py` and never call OpenAI. Keep it that way.

## Never

- Read, print or commit `backend/.env` or any key. Use `.env.example` for new settings.
- Commit `uploads/`, `chroma/`, `tts_cache/`, or anything with personal data.
- Add 3D avatars or other assets without a licence that allows commercial use (see `frontend/public/avatars/LICENSE.md`).
