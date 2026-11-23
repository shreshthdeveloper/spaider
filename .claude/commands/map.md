Rebuild the project map and show what changed:

1. From `backend/`: `python -m scripts.project_map`
2. `git diff --stat docs/PROJECT_MAP.md`, then list the routes and functions that were added, removed or renamed.

If a new function has no docstring (its line in the map is empty), write one in plain words and run step 1 again.
