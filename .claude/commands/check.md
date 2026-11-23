Run every check and report what fails, with the file and line:

1. From `backend/`: `ruff check .` then `pytest -q`
2. From `frontend/`: `npm run lint` then `npm run build`

If something fails, explain the cause in one or two sentences and propose the smallest fix. Don't change any code
until I say so.
