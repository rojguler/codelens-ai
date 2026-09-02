"""
github_client.py — GitHub REST API wrapper for CodeLens Repository Analysis.

Responsibilities:
  - Fetch repository metadata (name, description, language, stars).
  - Fetch the full recursive file tree via the Git Trees API.
  - Filter files by priority: config/root files first, then source code.
  - Fetch individual file contents (base64-decoded).
  - Build a single consolidated text context ready for the LLM.

No authentication required for public repositories.
Set GITHUB_TOKEN in .env to raise the rate limit from 60 → 5000 req/hour.
"""

import os
import re
import base64
from typing import Optional
import httpx
from dotenv import load_dotenv

load_dotenv()

# ── Constants ─────────────────────────────────────────────────────────────────

GITHUB_API = "https://api.github.com"
MAX_FILES = 10           # Fetch top 10 highest-priority files (fast & fits Vercel timeouts)
MAX_FILE_CHARS = 3_000   # Characters per file
MAX_TOTAL_CHARS = 35_000 # Cap on combined context size for fast LLM inference
REQUEST_TIMEOUT = 10.0   # Seconds per HTTP request

# ── File filtering rules ──────────────────────────────────────────────────────

# Directories to always skip
_SKIP_DIRS = {
    "node_modules", ".git", "dist", "build", "out", "__pycache__",
    ".venv", "venv", "env", ".env", "vendor", "coverage", ".next",
    ".nuxt", "target", "bin", "obj", ".idea", ".vscode", "eggs",
    ".mypy_cache", ".pytest_cache", ".ruff_cache",
}

# File extensions to always skip (binary / generated / lock)
_SKIP_EXTENSIONS = {
    # Images & media
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".bmp",
    # Fonts
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    # Archives
    ".zip", ".tar", ".gz", ".rar", ".7z",
    # Binary / compiled
    ".pyc", ".pyo", ".so", ".dll", ".exe", ".o", ".a", ".lib",
    # Docs / data blobs
    ".pdf", ".docx", ".xlsx",
    # Minified / generated
    ".map",
}

# Exact filenames that should be skipped (lock files etc.)
_SKIP_FILENAMES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "poetry.lock", "pipfile.lock", "gemfile.lock", "composer.lock",
    "cargo.lock",
}

# Exact filenames that are always high-priority (lowercase)
_PRIORITY_FILES = {
    "readme.md", "readme.rst", "readme.txt", "readme",
    "package.json", "pyproject.toml", "requirements.txt", "requirements-dev.txt",
    "cargo.toml", "pom.xml", "build.gradle", "build.gradle.kts",
    "go.mod", "gemfile", "composer.json", "setup.py", "setup.cfg",
    "main.py", "app.py", "index.py", "server.py", "run.py",
    "main.js", "index.js", "app.js", "server.js",
    "main.ts", "index.ts", "app.ts", "server.ts",
    "main.go", "main.rs", "main.java", "program.cs",
    "app.jsx", "app.tsx", "main.jsx", "main.tsx",
    "dockerfile", "docker-compose.yml", "docker-compose.yaml",
    "makefile", "justfile",
}

# Source code extensions (lower priority than _PRIORITY_FILES but included)
_SOURCE_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".go", ".rs",
    ".java", ".cs", ".rb", ".php", ".swift", ".kt", ".cpp", ".c",
    ".h", ".hpp", ".sh", ".bash", ".zsh", ".fish",
    ".yaml", ".yml", ".toml", ".ini", ".cfg",
    ".md", ".rst",
}

# ── URL Parsing ───────────────────────────────────────────────────────────────

_GITHUB_URL_RE = re.compile(
    r"^(?:https?://)?(?:www\.)?github\.com/([a-zA-Z0-9_.\-]+)/([a-zA-Z0-9_.\-]+?)(?:\.git|/.*)?$",
    re.IGNORECASE
)


def parse_github_url(url: str) -> tuple[str, str]:
    """
    Extract (owner, repo) from a GitHub URL.
    Supports https://github.com/owner/repo, http://, and github.com/owner/repo,
    as well as URLs with query strings, hashes, or trailing subpaths.
    Raises ValueError for non-GitHub or malformed URLs.
    """
    cleaned = url.strip()
    # Strip query parameters (?) and fragment hashes (#)
    cleaned = cleaned.split("?")[0].split("#")[0].rstrip("/")
    match = _GITHUB_URL_RE.match(cleaned)
    if not match:
        raise ValueError(
            "Invalid GitHub URL. Expected format: https://github.com/owner/repo"
        )
    owner = match.group(1)
    repo = match.group(2)
    if repo.endswith(".git"):
        repo = repo[:-4]
    if owner in (".", "..") or repo in (".", ".."):
        raise ValueError("Invalid GitHub repository or owner name.")
    return owner, repo


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def _make_headers() -> dict:
    """Build request headers; include token if available and User-Agent."""
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "CodeLens-App/1.0",
    }
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _get(path: str, client: Optional[httpx.Client] = None) -> dict | list:
    """
    GET request to the GitHub API with connection reuse and error handling.
    If client is provided, reuses the existing connection pool.
    """
    url = f"{GITHUB_API}{path}" if path.startswith("/") else path
    headers = _make_headers()

    try:
        if client is not None:
            resp = client.get(url, headers=headers)
        else:
            with httpx.Client(timeout=REQUEST_TIMEOUT) as c:
                resp = c.get(url, headers=headers)
    except httpx.TimeoutException:
        raise RuntimeError("GitHub API request timed out. Please try again later.")
    except httpx.RequestError as e:
        raise RuntimeError(f"Failed to connect to GitHub API: {str(e)}")

    if resp.status_code == 404:
        raise ValueError("Repository not found. Make sure it exists and is public.")
    if resp.status_code == 409:
        raise ValueError("Repository is empty (no commits found).")
    if resp.status_code == 403:
        raise RuntimeError(
            "GitHub API rate limit exceeded. "
            "Add a GITHUB_TOKEN to backend/.env to increase the limit to 5000 req/hour."
        )
    if resp.status_code != 200:
        raise RuntimeError(f"GitHub API error {resp.status_code}: {resp.text[:200]}")
    return resp.json()


# ── Repo metadata ─────────────────────────────────────────────────────────────

def fetch_repo_meta(owner: str, repo: str, client: Optional[httpx.Client] = None) -> dict:
    """Return basic repository metadata."""
    data = _get(f"/repos/{owner}/{repo}", client=client)
    return {
        "owner": owner,
        "name": repo,
        "full_name": data.get("full_name", f"{owner}/{repo}"),
        "description": data.get("description") or "",
        "language": data.get("language") or "Unknown",
        "stars": data.get("stargazers_count", 0),
        "forks": data.get("forks_count", 0),
        "license": (data.get("license") or {}).get("spdx_id", ""),
        "default_branch": data.get("default_branch", "main"),
        "size_kb": data.get("size", 0),
        "private": data.get("private", False),
    }


# ── File tree ─────────────────────────────────────────────────────────────────

def fetch_repo_tree(owner: str, repo: str, branch: str = "main", client: Optional[httpx.Client] = None) -> list[dict]:
    """
    Fetch the full recursive file tree.
    Falls back to 'master' then 'HEAD' if the primary branch returns an error.
    """
    for ref in (branch, "master", "HEAD"):
        try:
            data = _get(f"/repos/{owner}/{repo}/git/trees/{ref}?recursive=1", client=client)
            return [item for item in data.get("tree", []) if item.get("type") == "blob"]
        except ValueError:
            continue
    raise ValueError("Could not fetch repository file tree.")


def _should_skip_path(path: str) -> bool:
    """Return True if this file path should be excluded from analysis."""
    parts = path.lower().split("/")

    # Skip if any directory segment is in the skip list
    for part in parts[:-1]:
        if part in _SKIP_DIRS:
            return True
        # Also skip hidden dirs (e.g. .cache, .tmp) except .github
        if part.startswith(".") and part != ".github":
            return True

    filename = parts[-1]

    # Skip by exact filename (lock files etc.)
    if filename in _SKIP_FILENAMES:
        return True

    # Skip by extension
    _, ext = os.path.splitext(filename)
    if ext.lower() in _SKIP_EXTENSIONS:
        return True

    return False


def _file_priority(path: str) -> int:
    """
    Lower number = higher priority.
    0: Priority files (README, package.json, entry points, etc.)
    1: Root-level source files
    2: Source files up to 2 levels deep
    3: Deeper source files
    4: Everything else
    """
    lower = path.lower()
    filename = lower.split("/")[-1]
    depth = lower.count("/")

    # Exact priority filenames
    if filename in _PRIORITY_FILES:
        return 0

    # .github/workflows
    if lower.startswith(".github/"):
        return 0

    _, ext = os.path.splitext(filename)
    is_source = ext.lower() in _SOURCE_EXTENSIONS

    if is_source and depth == 0:
        return 1
    if is_source and depth <= 2:
        return 2
    if is_source:
        return 3
    return 4


def filter_files(tree: list[dict]) -> list[dict]:
    """
    From the full tree, return the MAX_FILES highest-priority files,
    excluding binary/generated paths.
    """
    candidates = [item for item in tree if not _should_skip_path(item["path"])]
    candidates.sort(key=lambda f: (_file_priority(f["path"]), f["path"]))
    return candidates[:MAX_FILES]


# ── File content ──────────────────────────────────────────────────────────────

def fetch_file_content(owner: str, repo: str, path: str, client: Optional[httpx.Client] = None) -> Optional[str]:
    """
    Fetch and decode a single file's content via the Contents API.
    Returns None if the file is binary or cannot be decoded.
    """
    try:
        data = _get(f"/repos/{owner}/{repo}/contents/{path}", client=client)
        if isinstance(data, list):
            # It's a directory, not a file
            return None
        encoding = data.get("encoding", "")
        raw = data.get("content", "")
        if encoding == "base64":
            decoded = base64.b64decode(raw).decode("utf-8", errors="replace")
            return decoded
        return raw
    except Exception:
        return None


# ── Context builder ───────────────────────────────────────────────────────────

def build_repo_context(owner: str, repo: str) -> dict:
    """
    Main entry point. Reuses an HTTP connection pool for all requests.
    Returns:
    {
        "meta": { ... },
        "context": "<LLM-ready text>",
        "files_analyzed": N,
        "files_total": M,
        "files_list": ["path1", ...],
    }
    """
    with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
        meta = fetch_repo_meta(owner, repo, client=client)

        if meta["private"]:
            raise ValueError(
                "Private repositories are not supported. Please use a public repository."
            )

        tree = fetch_repo_tree(owner, repo, meta["default_branch"], client=client)
        files_total = len(tree)

        selected = filter_files(tree)

        sections: list[str] = []
        total_chars = 0
        files_included: list[str] = []

        for file_info in selected:
            if total_chars >= MAX_TOTAL_CHARS:
                break

            path = file_info["path"]
            content = fetch_file_content(owner, repo, path, client=client)
            if content is None:
                continue

            # Truncate oversized individual files
            if len(content) > MAX_FILE_CHARS:
                omitted = len(content) - MAX_FILE_CHARS
                content = content[:MAX_FILE_CHARS] + f"\n... [truncated — {omitted} more chars]"

            section = f"=== {path} ===\n{content}"
            sections.append(section)
            files_included.append(path)
            total_chars += len(section)

    context = "\n\n".join(sections)

    return {
        "meta": meta,
        "context": context,
        "files_analyzed": len(files_included),
        "files_total": files_total,
        "files_list": files_included,
    }
