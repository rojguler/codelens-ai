# CodeLens — AI-Powered Developer Assistant

CodeLens is a developer assistance tool that provides automated code reviews, vulnerability detection, refactoring recommendations, and multi-file GitHub repository analysis using FastAPI, React, and Google's Gemini 2.5 Flash model.

---

## Features

- **AI Code Review**: Comprehensive inspection of code logic, style, and maintainability.
- **Bug Detection**: Identification of runtime issues, edge cases, off-by-one errors, and logical faults with suggested fixes.
- **Security Analysis**: Static analysis for common vulnerabilities (injection risks, insecure configurations, credential exposure) with severity classifications.
- **Code Explanation**: Plain-language breakdown of complex algorithms, functions, and architecture.
- **Refactoring Suggestions**: Structural improvements, design pattern applications, and idiomatic clean-code modifications.
- **Test Generation**: Automated unit test scaffolding targeting language-specific testing frameworks (e.g., pytest, Jest, JUnit).
- **GitHub Repository Analysis**: In-depth repository inspection analyzing file trees, configuration files, and key source files to generate high-level architectural summaries, tech stack identification, strengths, and prioritized recommendations.
- **Multi-Language Support**: Dedicated support for JavaScript, TypeScript, Python, Java, C, C++, C#, Go, Rust, Ruby, PHP, Swift, Kotlin, SQL, Bash, and general text.

---

## Demo

**Live Application:** [https://codelens-ai-pi.vercel.app](https://codelens-ai-pi.vercel.app)

A local demonstration can be run using the instructions in the [Installation](#installation) section.

- Local Frontend: `http://localhost:5173`
- Local Backend API: `http://localhost:8000`
- Interactive API Docs (Swagger): `http://localhost:8000/docs`

---

## Screenshots

<!-- Screenshots will be added to docs/screenshots/ before the first public release -->
<!-- To capture: run the app locally and save screenshots as docs/screenshots/code-analysis.png and docs/screenshots/repository-analysis.png -->

1. **Code Analysis View**
   ![Code Analysis View](docs/screenshots/code-analysis.png)
   *Code editor with mode selector (Review, Bug Detection, Security, Explanation, Refactor, Tests) and structured result cards.*

2. **Repository Analysis View**
   ![Repository Analysis View](docs/screenshots/repository-analysis.png)
   *GitHub repository metrics (stars, forks, language, license) and architectural breakdown.*

---

## Architecture

```
┌─────────────────┐         HTTP (JSON)         ┌──────────────────┐
│                 │ ──────────────────────────> │                  │
│  React Frontend │                             │  FastAPI Backend │
│  (Vite + CSS)   │ <────────────────────────── │  (Python 3.10+)  │
└─────────────────┘                             └────────┬─────────┘
                                                         │
                                    ┌────────────────────┴────────────────────┐
                                    ▼                                         ▼
                        ┌───────────────────────┐                 ┌───────────────────────┐
                        │   GitHub REST API     │                 │   Google Gemini API   │
                        │ (Public Repositories) │                 │  (gemini-2.5-flash)   │
                        └───────────────────────┘                 └───────────────────────┘
```

### GitHub Repository Analysis Flow

```
1. Client submits GitHub URL -> POST /api/analyze-repo
2. Backend parses & validates URL (owner/repo extraction)
3. Backend fetches repository metadata (stars, forks, language, default branch)
4. Git Trees API fetches full recursive file tree
5. Priority filter selects up to 20 key files (configs, entry points, core source)
6. Backend downloads & decodes file contents in connection pool
7. Context builder aggregates files into a unified prompt
8. Gemini 2.5 Flash processes context and returns structured JSON schema
9. Backend validates, normalizes list outputs, and returns response to Client
```

---

## Tech Stack

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: Vanilla CSS (CSS custom properties, responsive layout)
- **Linter**: Oxlint

### Backend
- **Framework**: FastAPI
- **Server**: Uvicorn (ASGI)
- **Validation**: Pydantic v2
- **HTTP Client**: HTTPX (connection pooling and timeout management)
- **Configuration**: Python-dotenv

### AI & Integrations
- **AI Model**: Google Gemini 2.5 Flash via `google-genai` SDK
- **External Integration**: GitHub REST API (v2022-11-28) with `User-Agent` compliance

---

## How It Works

### 1. Code Analysis Workflow
1. **Input Submission**: The user pastes a code snippet up to 20,000 characters, selects the language, and chooses one of six analysis modes.
2. **Mode-Specific Prompts**: The backend dynamically assigns system instructions tailored to the chosen mode (e.g., debugging-only, test generation, or comprehensive review).
3. **Structured Extraction**: The Gemini API is prompted to output a strictly typed JSON object containing summary, bugs, security issues, quality notes, refactoring items, and improved code.
4. **Resilient Parsing**: The response parser handles raw JSON, markdown-wrapped JSON, and normalizes nested list formats before schema validation.

### 2. Repository Analysis Workflow
1. **URL Validation**: Incoming repository URLs are sanitized (stripping query parameters and hash fragments) and parsed into `owner` and `repo` tokens.
2. **Tree Traversal & Priority Sorting**: Using the GitHub Git Trees API, files are filtered against exclusion rules (`node_modules`, lockfiles, binary formats) and sorted by architectural significance (configuration files, entry points, top-level source files).
3. **Budgeted Aggregation**: The top 20 candidate files are fetched with individual size caps (4,000 characters) and a combined context limit (80,000 characters).
4. **Holistic Review**: The aggregated codebase context is analyzed by Gemini to generate high-level architectural documentation, strengths, issues, and actionable recommendations.

---

## Installation

### Prerequisites
- Node.js (v18.0.0 or later)
- Python (v3.10 or later)
- Google Gemini API Key ([Get an API key from Google AI Studio](https://aistudio.google.com/app/apikey))
- Optional: GitHub Personal Access Token (raises rate limit from 60 to 5,000 req/hour)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/codelens.git
cd codelens
```

### 2. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create and activate a virtual environment
python -m venv venv

# Windows (Command Prompt / PowerShell)
.\venv\Scripts\activate

# Linux / macOS
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
copy .env.example .env   # Windows
# or: cp .env.example .env  # Linux/macOS
```

Open `backend/.env` and insert your API credentials:
```env
# Required: Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: GitHub Personal Access Token (increases rate limit)
# GITHUB_TOKEN=your_github_token_here

# Optional: Allowed CORS Origins (comma-separated)
# CORS_ORIGINS=http://localhost:5173,http://localhost:4173
```

Start the FastAPI server:
```bash
uvicorn main:app --reload --port 8000
```
Backend will be available at `http://localhost:8000`.

### 3. Frontend Setup
In a new terminal window:
```bash
# Navigate to frontend directory
cd frontend

# Install npm dependencies
npm install

# Start the Vite development server
npm run dev
```
Frontend will be available at `http://localhost:5173`.

---

## API Endpoints

| Method | Path | Description | Request Body |
|---|---|---|---|
| `GET` | `/api/health` | Health check, supported modes, and credential status | None |
| `POST` | `/api/analyze` | Analyzes a single code snippet using the selected mode | `{"code": str, "language": str, "mode": str}` |
| `POST` | `/api/analyze-repo` | Fetches and analyzes a public GitHub repository | `{"url": str}` |

Interactive API documentation is automatically available at `http://localhost:8000/docs` when the backend is running.

---

## Project Structure

```
codelens/
├── .gitignore                    # Global git ignore configuration
├── LICENSE                       # MIT License
├── README.md                     # Project documentation
├── docs/
│   └── screenshots/              # App screenshots for README
│
├── backend/
│   ├── .env.example              # Template for environment variables (no real secrets)
│   ├── requirements.txt          # Python dependencies
│   ├── main.py                   # FastAPI application, CORS, and endpoint routing
│   ├── github_client.py          # GitHub REST API client, tree filtering, context builder
│   └── llm_client.py             # Gemini API integration, prompt templates, JSON parsers
│
└── frontend/
    ├── .gitignore                # Frontend-specific git ignore rules
    ├── index.html                # HTML entry point with web font imports
    ├── package.json              # Frontend scripts and dependencies
    ├── vite.config.js            # Vite configuration and backend API proxy
    │
    └── src/
        ├── App.jsx               # Tab management, API state handlers, error handling
        ├── index.css             # Design tokens, theme variables, reset, utility styles
        ├── main.jsx              # React DOM mounting
        │
        └── components/
            ├── Header.jsx         # Application header and branding
            ├── CodeEditor.jsx     # Mode buttons, language selector, textarea with tab support
            ├── AnalysisResult.jsx # Collapsible analysis cards, bullet lists, code copy block
            ├── RepoInput.jsx      # GitHub URL input form with validation and clear button
            ├── RepoMeta.jsx       # Repository statistics, tech chips, and architectural reports
            └── GithubIcon.jsx     # SVG GitHub mark component (lucide-react compat shim)
```

---

## Security

- **Environment-Isolated Secrets**: API keys are loaded via `.env` files and environment variables on the backend. No secret credentials are hardcoded or delivered to client browsers.
- **Secret Redaction in Errors**: Error handlers use regex-based sanitizers to strip Gemini API keys and GitHub personal access tokens (`[REDACTED]`) before returning responses.
- **Input Validation**:
  - Code inputs are bounded to a maximum of 20,000 characters per analysis (with schema-level 50,000 character rejection).
  - GitHub URLs are strictly validated against supported schemes, domain structure, and segment sanitization.
- **Resource Constraints**:
  - Repository analysis fetches a maximum of 20 files.
  - Per-file character limits (4,000 characters) and total context caps (80,000 characters) prevent memory exhaustion and excessive token usage.
- **Safe Network Clients**: Explicit timeouts (15s) and `User-Agent` headers are enforced on all external HTTP requests to prevent connection hangs and gateway blocks.

---

## Future Improvements

The following capabilities are considered for future releases and are **not currently implemented**:

- **GitHub OAuth & Private Repositories**: Authenticated user sessions allowing access to private repositories.
- **RAG-Based Project Context**: Vector database indexing to search across large codebases without hitting prompt window limits.
- **Persistent Analysis History**: Database integration to save, export, and compare review histories across time.
- **IDE Extensions**: Direct integration with editors such as VS Code or JetBrains IDEs.

---

## License

This project is licensed under the [MIT License](LICENSE).
