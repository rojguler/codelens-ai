import os
import sys

# Ensure backend directory is in sys.path for Vercel serverless functions
_backend_dir = os.path.dirname(os.path.abspath(__file__))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

import re
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from llm_client import analyze_code, analyze_repo, VALID_MODES
from github_client import parse_github_url, build_repo_context

load_dotenv()

app = FastAPI(title="CodeLens API")
handler = app

# ── CORS configuration ────────────────────────────────────────────────────────
default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]
env_origins = os.getenv("CORS_ORIGINS", "")
allowed_origins = [o.strip() for o in env_origins.split(",") if o.strip()] or default_origins
allow_credentials = "*" not in allowed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ── Error sanitization helper ─────────────────────────────────────────────────
_SECRET_PATTERNS = [
    re.compile(r"AIza[0-9A-Za-z-_]{30,45}"),
    re.compile(r"AQ\.[0-9A-Za-z-_]{30,}"),
    re.compile(r"gh[pousr]_[0-9A-Za-z]{36,255}"),
]


def _sanitize_error(msg: str) -> str:
    """Ensure sensitive API keys or tokens are never leaked in error messages."""
    for secret_env in ("GEMINI_API_KEY", "GITHUB_TOKEN"):
        val = os.getenv(secret_env)
        if val and len(val) > 4 and val in msg:
            msg = msg.replace(val, "[REDACTED]")
    for pattern in _SECRET_PATTERNS:
        msg = pattern.sub("[REDACTED]", msg)
    return msg


# ── Code analysis models ──────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    code: str = Field(..., max_length=50_000)
    language: str = Field(default="JavaScript", max_length=50)
    mode: str = "full_review"


class AnalyzeResponse(BaseModel):
    summary: str
    bugs: list[str]
    security: list[str]
    quality: list[str]
    refactoring: list[str]
    improved_code: str


# ── Repository analysis models ────────────────────────────────────────────────

class RepoRequest(BaseModel):
    url: str = Field(max_length=500)


class RepoResponse(BaseModel):
    # Repo metadata
    full_name: str
    description: str
    language: str
    stars: int
    forks: int
    license: str
    files_analyzed: int
    files_total: int
    files_list: list[str]
    # LLM analysis
    overview: str
    architecture: str
    tech_stack: list[str]
    strengths: list[str]
    issues: list[str]
    security: list[str]
    recommendations: list[str]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "modes": list(VALID_MODES),
        "api_configured": bool(os.getenv("GEMINI_API_KEY")),
        "github_token_configured": bool(os.getenv("GITHUB_TOKEN")),
    }


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    if not req.code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty.")
    if len(req.code) > 20_000:
        raise HTTPException(status_code=400, detail="Code is too long (max 20 000 chars).")
    if req.mode not in VALID_MODES:
        raise HTTPException(status_code=400, detail=f"Invalid mode '{req.mode}'. Valid modes: {sorted(VALID_MODES)}")

    try:
        result = analyze_code(req.code, req.language, req.mode)
    except RuntimeError as e:
        err_str = _sanitize_error(str(e))
        status_code = 429 if ("rate limit" in err_str.lower() or "quota" in err_str.lower()) else 500
        raise HTTPException(status_code=status_code, detail=err_str)
    except Exception as e:
        raise HTTPException(status_code=500, detail=_sanitize_error(f"LLM error: {str(e)[:150]}"))

    return AnalyzeResponse(**result)


@app.post("/api/analyze-repo", response_model=RepoResponse)
def analyze_repo_endpoint(req: RepoRequest):
    cleaned_url = req.url.strip()
    if not cleaned_url:
        raise HTTPException(status_code=400, detail="Repository URL cannot be empty.")

    # Parse URL
    try:
        owner, repo = parse_github_url(cleaned_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=_sanitize_error(str(e)))

    # Fetch repo data from GitHub
    try:
        repo_data = build_repo_context(owner, repo)
    except ValueError as e:
        status_code = 400 if "empty" in str(e).lower() else 404
        raise HTTPException(status_code=status_code, detail=_sanitize_error(str(e)))
    except RuntimeError as e:
        err_str = _sanitize_error(str(e))
        status_code = 429 if "rate limit" in err_str.lower() else 502
        raise HTTPException(status_code=status_code, detail=err_str)
    except Exception as e:
        raise HTTPException(status_code=502, detail=_sanitize_error(f"GitHub connection error: {str(e)[:150]}"))

    meta = repo_data["meta"]
    context = repo_data["context"]
    files_list = repo_data["files_list"]
    files_total = repo_data["files_total"]

    # Analyse with LLM
    try:
        analysis = analyze_repo(meta, context, files_list)
    except RuntimeError as e:
        err_str = _sanitize_error(str(e))
        status_code = 429 if ("rate limit" in err_str.lower() or "quota" in err_str.lower()) else 500
        raise HTTPException(status_code=status_code, detail=err_str)
    except Exception as e:
        raise HTTPException(status_code=500, detail=_sanitize_error(f"LLM error: {str(e)[:150]}"))

    return RepoResponse(
        full_name=meta["full_name"],
        description=meta["description"],
        language=meta["language"],
        stars=meta["stars"],
        forks=meta["forks"],
        license=meta["license"],
        files_analyzed=len(files_list),
        files_total=files_total,
        files_list=files_list,
        **analysis,
    )
