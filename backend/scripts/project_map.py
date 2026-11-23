"""Writes docs/PROJECT_MAP.md: every API route, every backend module and function, and every frontend file,
each with one line on what it does. The lines come from the code's own docstrings and comments, so the map
stays true: to change a line, change the docstring, then run this again. From backend/:

    python -m scripts.project_map
"""
import ast
import re
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
FRONTEND = BACKEND.parent / "frontend" / "src"
OUTPUT = BACKEND.parent / "docs" / "PROJECT_MAP.md"

HTTP_METHODS = ["get", "post", "put", "patch", "delete"]
SKIP_FOLDERS = [".venv", "__pycache__", "tests", "chroma", "uploads", "tts_cache"]
MAX_LINE = 220  # characters: longer summaries are cut with "…"

# The order the backend sections appear in, with a short title for each.
SECTIONS = [
    ("", "Start-up"),
    ("models", "Models (MongoEngine documents: one per MongoDB collection)"),
    ("routes", "Routes (HTTP only: check the request, call a service, return JSON)"),
    ("services", "Services (the app's logic)"),
    ("evals", "Evals (measure the AI judges against labelled cases)"),
    ("scripts", "Scripts (developer tools)"),
]


def main():
    """Builds the whole map and writes it to docs/PROJECT_MAP.md."""
    parts = [
        "# Project map",
        "",
        "Every API route, backend function and frontend file, with one line on what it does. Generated from the",
        "code's docstrings and comments by `python -m scripts.project_map` (run from `backend/`): don't edit this",
        "file by hand. Change the docstring or comment, then run the script again.",
        "",
        "## API routes",
        "",
        "Every route lives under `/api`. Its handler is in `backend/routes/`.",
        "",
        "| Method | Path | Handler | What it does |",
        "|---|---|---|---|",
    ]
    for route in _routes():
        parts.append(f"| {route['method']} | `{route['path']}` | `{route['handler']}` | {route['summary']} |")

    parts.append("")
    parts.append("## Backend")
    for folder, title in SECTIONS:
        parts.append("")
        parts.append(f"### {title}")
        for path in _python_files(folder):
            parts.extend(_module_lines(path))

    parts.append("")
    parts.append("## Frontend")
    parts.append("")
    parts.append("React + Vite in `frontend/src/`. Every backend call goes through `lib/api.js`.")
    for folder in ["pages", "components", "lib", "styles"]:
        parts.append("")
        parts.append(f"### {folder}/")
        parts.append("")
        for path in _frontend_files(folder):
            name = path.relative_to(FRONTEND).as_posix()
            parts.append(f"- `{name}`: {_frontend_summary(path)}")

    OUTPUT.write_text("\n".join(parts) + "\n")
    print(f"Wrote {OUTPUT.relative_to(BACKEND.parent)}")


# ---------------------------------------------------------------- routes
def _routes():
    """Every route in routes/*.py: its method, path, handler and the first line of its docstring."""
    routes = []
    for path in sorted((BACKEND / "routes").glob("*.py")):
        tree = ast.parse(path.read_text())
        for node in tree.body:
            if not isinstance(node, ast.FunctionDef):
                continue
            for decorator in node.decorator_list:
                method, route_path = _route_of(decorator)
                if method:
                    full_path = "/api" + route_path
                    routes.append({
                        "method": method,
                        "path": full_path,
                        "handler": f"{path.stem}.{node.name}",
                        "summary": _route_summary(ast.get_docstring(node) or "", method, full_path),
                    })
    return routes


def _route_of(decorator):
    """("POST", "/interviews") for @interview_bp.post("/interviews"), or (None, None) for any other decorator."""
    if not isinstance(decorator, ast.Call) or not isinstance(decorator.func, ast.Attribute):
        return None, None
    method = decorator.func.attr
    if method not in HTTP_METHODS or not decorator.args or not isinstance(decorator.args[0], ast.Constant):
        return None, None
    return method.upper(), decorator.args[0].value


# "POST /api/interviews/<id>/answer" at the start of a route's docstring (the table already shows it)
ROUTE_AT_START = re.compile(r"^(GET|POST|PUT|PATCH|DELETE) /api/\S*\s*:?\s*")


def _route_summary(docstring, method, full_path):
    """A route's docstring without the "POST /api/..." it starts with."""
    text = ROUTE_AT_START.sub("", _one_line(docstring))
    return _cut(text.replace("|", "/"))


# ---------------------------------------------------------------- backend modules
def _python_files(folder):
    """The .py files of one section, sorted. "" = the files directly in backend/ (app.py, db.py)."""
    if folder == "":
        found = sorted(BACKEND.glob("*.py"))
    else:
        found = sorted((BACKEND / folder).rglob("*.py"))
    files = []
    for path in found:
        if path.name == "__init__.py":
            continue
        skipped = False
        for part in path.relative_to(BACKEND).parts:
            if part in SKIP_FOLDERS:
                skipped = True
        if not skipped:
            files.append(path)
    return files


def _module_lines(path):
    """The lines for one module: its name and summary, then one line per top-level function or class."""
    source = path.read_text()
    tree = ast.parse(source)
    lines = ["", f"**`{path.relative_to(BACKEND).as_posix()}`**", ""]
    summary = _first_paragraph(ast.get_docstring(tree) or "")
    if summary:
        lines.append(_cut(summary))
        lines.append("")
    comments = _comments_above(source)
    for node in tree.body:
        if isinstance(node, ast.FunctionDef):
            text = _first_paragraph(ast.get_docstring(node) or "")
            lines.append(f"- `{node.name}({_arguments(node)})`: {_cut(text)}")
        elif isinstance(node, ast.ClassDef):
            text = _first_paragraph(ast.get_docstring(node) or "") or comments.get(node.lineno, "")
            lines.append(f"- class `{node.name}`: {_cut(text)}")
    return lines


def _arguments(function):
    """"interview, text" for def submit_answer(interview, text)."""
    names = []
    for argument in function.args.args:
        names.append(argument.arg)
    return ", ".join(names)


def _comments_above(source):
    """{line number: the comment on the line just above it}. Schema classes have a comment, not a docstring."""
    found = {}
    lines = source.split("\n")
    for index in range(1, len(lines)):
        above = lines[index - 1].strip()
        if above.startswith("#"):
            found[index + 1] = above.lstrip("#").strip()
    return found


# ---------------------------------------------------------------- frontend files
def _frontend_files(folder):
    """The .js, .jsx and .css files in one frontend folder, sorted."""
    files = []
    for path in sorted((FRONTEND / folder).rglob("*")):
        if path.suffix in (".js", ".jsx", ".css"):
            files.append(path)
    return files


def _frontend_summary(path):
    """The comment just above the file's main export, or else its first comment."""
    lines = path.read_text().split("\n")
    for index, line in enumerate(lines):
        if line.startswith("export default") or line.startswith("export function use"):
            comment = _comment_block_above(lines, index)
            if comment:
                return _cut(comment)
    for line in lines:
        text = line.strip()
        if text.startswith("//") or text.startswith("/*"):
            return _cut(text.lstrip("/*").rstrip("*/").strip())
    return ""


def _comment_block_above(lines, index):
    """The // comment lines right above line `index`, joined, or "" if there are none."""
    block = []
    row = index - 1
    while row >= 0 and lines[row].strip().startswith("//"):
        block.insert(0, lines[row].strip().lstrip("/").strip())
        row -= 1
    return _first_paragraph("\n".join(block))


# ---------------------------------------------------------------- text helpers
def _first_paragraph(text):
    """The text up to its first empty line, on one line."""
    return _one_line(text.strip().split("\n\n")[0])


def _one_line(text):
    """All the lines of `text` joined by single spaces."""
    return " ".join(text.split())


def _cut(text):
    """At most MAX_LINE characters."""
    if len(text) <= MAX_LINE:
        return text
    return text[: MAX_LINE - 1].rstrip() + "…"


if __name__ == "__main__":
    main()
