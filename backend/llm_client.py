import os
import json
import re
from google import genai
from dotenv import load_dotenv

load_dotenv()

_client = None

# ── Supported analysis modes ──────────────────────────────────────────────────
VALID_MODES = {
    "full_review",
    "bug_detection",
    "security_analysis",
    "code_explanation",
    "refactoring",
    "test_generation",
}


def _get_client() -> genai.Client:
    """Lazily initialize and return the Gemini client."""
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. "
                "Add it to backend/.env or set it as an environment variable."
            )
        _client = genai.Client(api_key=api_key)
    return _client


MODEL = "gemini-2.5-flash"

# ── JSON schema shared by all modes ──────────────────────────────────────────
_SCHEMA = """{
  "summary": "string",
  "bugs": ["string"],
  "security": ["string"],
  "quality": ["string"],
  "refactoring": ["string"],
  "improved_code": "string"
}"""

_EMPTY_FIELDS = {
    "summary": "",
    "bugs": [],
    "security": [],
    "quality": [],
    "refactoring": [],
    "improved_code": "",
}

# ── Mode-specific system instructions ────────────────────────────────────────
_MODE_INSTRUCTIONS: dict[str, str] = {
    "full_review": """You are an expert code reviewer. Perform a comprehensive review of the code.
Fill ALL fields of the JSON response:
- summary: Brief description of what the code does (2-3 sentences).
- bugs: All logical errors, runtime issues, and incorrect behaviour.
- security: Security vulnerabilities (injection, exposure, etc.).
- quality: Code quality, style, and maintainability suggestions.
- refactoring: Structural improvements and design pattern suggestions.
- improved_code: Complete refactored version of the code.""",

    "bug_detection": """You are a senior software engineer specialised in debugging.
Focus ONLY on bugs, runtime errors, and logical mistakes.
- summary: Brief description of what the code does.
- bugs: Every bug you find. For each: describe the bug, explain why it occurs, and provide the fix.
- security: Leave as empty list [].
- quality: Leave as empty list [].
- refactoring: Leave as empty list [].
- improved_code: The corrected version of the code with all bugs fixed. If no bugs found, write "No bugs found.".""",

    "security_analysis": """You are a security expert and penetration tester.
Analyse the code exclusively for security vulnerabilities.
- summary: Brief description of what the code does.
- bugs: Leave as empty list [].
- security: Every security issue found. For each: name the vulnerability, rate its severity (Critical / High / Medium / Low), and explain how to fix it.
- quality: Leave as empty list [].
- refactoring: Leave as empty list [].
- improved_code: The hardened version of the code with all security issues fixed. If no issues found, write "No security issues found.".""",

    "code_explanation": """You are a patient programming teacher who excels at explaining code clearly.
- summary: A thorough, plain-language explanation of what the code does (3-5 sentences).
- bugs: Leave as empty list [].
- security: Leave as empty list [].
- quality: Explain each important function, class, or logic block and what role it plays.
- refactoring: Leave as empty list [].
- improved_code: Leave as empty string "".""",

    "refactoring": """You are a software architect focused on clean code and design patterns.
- summary: Brief description of what the code currently does.
- bugs: Leave as empty list [].
- security: Leave as empty list [].
- quality: Specific code quality issues: naming, readability, duplication, complexity.
- refactoring: Concrete refactoring steps. Mention design patterns where applicable.
- improved_code: The fully refactored, production-ready version of the code.""",

    "test_generation": """You are a senior QA engineer and testing expert.
- summary: Brief description of what the code does and what needs to be tested.
- bugs: Any obvious bugs you notice that should also be covered by tests.
- security: Leave as empty list [].
- quality: Leave as empty list [].
- refactoring: Leave as empty list [].
- improved_code: A complete set of unit tests for the provided code. Use the appropriate testing framework for the language (e.g. pytest for Python, Jest for JavaScript/TypeScript, JUnit for Java). Include happy path, edge cases, and error cases.""",
}


def _build_prompt(code: str, language: str, mode: str) -> str:
    instructions = _MODE_INSTRUCTIONS.get(mode, _MODE_INSTRUCTIONS["full_review"])
    return f"""{instructions}

Return your response in the following EXACT JSON format (raw JSON only, no markdown fences):

{_SCHEMA}

Code to analyse ({language}):
```{language.lower()}
{code}
```

Respond with only the JSON object, no additional text."""


def _extract_json(raw: str) -> dict:
    """Extract and parse a JSON dictionary from LLM output, handling markdown blocks."""
    raw = raw.strip()

    # 1. Try parsing directly
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass

    # 2. Extract from markdown code block ```json ... ``` or ``` ... ```
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw)
    if match:
        try:
            data = json.loads(match.group(1).strip())
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass

    # 3. Extract between first '{' and last '}'
    first_brace = raw.find("{")
    last_brace = raw.rfind("}")
    if first_brace != -1 and last_brace > first_brace:
        try:
            data = json.loads(raw[first_brace:last_brace + 1])
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass

    raise ValueError("Could not parse valid JSON from LLM response.")


def _normalize_str_list(items) -> list[str]:
    """Ensure all items in a list are strings, flattening any dicts returned by LLM."""
    if not isinstance(items, list):
        return []
    normalized: list[str] = []
    for item in items:
        if isinstance(item, str):
            normalized.append(item)
        elif isinstance(item, dict):
            desc = item.get("description") or item.get("issue") or item.get("message") or item.get("name")
            if desc:
                fix = item.get("fix") or item.get("recommendation")
                normalized.append(f"{desc} (Fix: {fix})" if fix else str(desc))
            else:
                normalized.append("; ".join(f"{k}: {v}" for k, v in item.items()))
        elif item is not None:
            normalized.append(str(item))
    return normalized


def _parse_response(raw: str) -> dict:
    try:
        data = _extract_json(raw)
        result = dict(_EMPTY_FIELDS)
        result["summary"] = str(data.get("summary", ""))
        result["bugs"] = _normalize_str_list(data.get("bugs"))
        result["security"] = _normalize_str_list(data.get("security"))
        result["quality"] = _normalize_str_list(data.get("quality"))
        result["refactoring"] = _normalize_str_list(data.get("refactoring"))
        result["improved_code"] = str(data.get("improved_code", ""))
        return result
    except Exception:
        return {**_EMPTY_FIELDS, "summary": raw.strip()}


def analyze_code(code: str, language: str, mode: str = "full_review") -> dict:
    """Send code to Gemini and return structured analysis for the given mode."""
    if mode not in VALID_MODES:
        mode = "full_review"

    client = _get_client()
    prompt = _build_prompt(code, language, mode)

    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=prompt,
        )
    except Exception as e:
        err_msg = str(e)
        if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg or "quota" in err_msg.lower():
            raise RuntimeError("Gemini API rate limit or quota exceeded. Please try again shortly.")
        if "API_KEY_INVALID" in err_msg or "api key not valid" in err_msg.lower() or "permissiondenied" in err_msg.lower():
            raise RuntimeError("Gemini API key is invalid or unauthorized. Please check backend/.env.")
        raise RuntimeError(f"Gemini API error: {err_msg[:200]}")

    if not response or not response.text:
        raise RuntimeError("LLM returned an empty response. The content may have been flagged or the service was unavailable.")

    return _parse_response(response.text)


# ── Repository analysis ────────────────────────────────────────────────────

_REPO_SCHEMA = """{
  "overview": "string",
  "architecture": "string",
  "tech_stack": ["string"],
  "strengths": ["string"],
  "issues": ["string"],
  "security": ["string"],
  "recommendations": ["string"]
}"""

_REPO_EMPTY = {
    "overview": "",
    "architecture": "",
    "tech_stack": [],
    "strengths": [],
    "issues": [],
    "security": [],
    "recommendations": [],
}

_REPO_SYSTEM = """You are a senior software architect performing a holistic code review of an entire GitHub repository.
Analyse the provided file contents and repository metadata.

Return your response in the following EXACT JSON format (raw JSON only, no markdown fences):

{schema}

Field guidelines:
- overview: 3-5 sentence plain-language summary of what the project does, its purpose, and target users.
- architecture: Describe the high-level design, component structure, and data flow (2-4 sentences).
- tech_stack: List of technologies, frameworks, languages, and key libraries detected. Each item is a short string.
- strengths: Positive aspects of the codebase (code quality, design decisions, testing, docs, etc.).
- issues: Bugs, anti-patterns, maintainability concerns, or code smells found across the files.
- security: Security vulnerabilities or risky patterns (e.g., exposed secrets, missing validation, unsafe deps).
- recommendations: Concrete, prioritised action items to improve the repository.

Be specific — mention file names and line-level details where relevant."""


def _build_repo_prompt(meta: dict, context: str, files_list: list[str]) -> str:
    meta_block = (
        f"Repository: {meta.get('full_name', '')}\n"
        f"Language: {meta.get('language', 'Unknown')}\n"
        f"Stars: {meta.get('stars', 0)}  Forks: {meta.get('forks', 0)}\n"
        f"License: {meta.get('license', 'N/A')}\n"
        f"Description: {meta.get('description', 'N/A')}\n"
        f"Files analysed ({len(files_list)}): {', '.join(files_list)}"
    )
    system = _REPO_SYSTEM.format(schema=_REPO_SCHEMA)
    return f"{system}\n\n=== REPOSITORY METADATA ===\n{meta_block}\n\n=== FILE CONTENTS ===\n{context}\n\nRespond with only the JSON object, no additional text."


def _parse_repo_response(raw: str) -> dict:
    try:
        data = _extract_json(raw)
        result = dict(_REPO_EMPTY)
        result["overview"] = str(data.get("overview", ""))
        result["architecture"] = str(data.get("architecture", ""))
        result["tech_stack"] = _normalize_str_list(data.get("tech_stack"))
        result["strengths"] = _normalize_str_list(data.get("strengths"))
        result["issues"] = _normalize_str_list(data.get("issues"))
        result["security"] = _normalize_str_list(data.get("security"))
        result["recommendations"] = _normalize_str_list(data.get("recommendations"))
        return result
    except Exception:
        return {**_REPO_EMPTY, "overview": raw.strip()}


def analyze_repo(meta: dict, context: str, files_list: list[str]) -> dict:
    """Send repository context to Gemini and return structured repository analysis."""
    client = _get_client()
    prompt = _build_repo_prompt(meta, context, files_list)

    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=prompt,
        )
    except Exception as e:
        err_msg = str(e)
        if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg or "quota" in err_msg.lower():
            raise RuntimeError("Gemini API rate limit or quota exceeded. Please try again shortly.")
        if "API_KEY_INVALID" in err_msg or "api key not valid" in err_msg.lower() or "permissiondenied" in err_msg.lower():
            raise RuntimeError("Gemini API key is invalid or unauthorized. Please check backend/.env.")
        raise RuntimeError(f"Gemini API error: {err_msg[:200]}")

    if not response or not response.text:
        raise RuntimeError("LLM returned an empty response. The repository content may have triggered safety limits.")

    return _parse_repo_response(response.text)
