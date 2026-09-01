import { useState, useEffect } from 'react'
import { Code2, AlertCircle, X, Loader2, Sparkles } from 'lucide-react'
import GithubIcon from './components/GithubIcon.jsx'
import Header from './components/Header.jsx'
import CodeEditor from './components/CodeEditor.jsx'
import AnalysisResult from './components/AnalysisResult.jsx'
import RepoInput from './components/RepoInput.jsx'
import RepoMeta from './components/RepoMeta.jsx'

function extractErrorMessage(detail, defaultMsg = 'An unexpected error occurred.') {
  if (!detail) return defaultMsg
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => (typeof item === 'object' && item?.msg ? item.msg : String(item)))
      .join('; ')
  }
  if (typeof detail === 'object' && detail?.msg) {
    return detail.msg
  }
  return defaultMsg
}

function getInitialTheme() {
  try {
    return localStorage.getItem('codelens-theme') || 'dark'
  } catch {
    return 'dark'
  }
}

export default function App() {
  // ── Theme state ────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('codelens-theme', theme)
    } catch {}
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('code') // 'code' | 'repo'

  // ── Code analysis state ───────────────────────────────────────────────────
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('JavaScript')
  const [mode, setMode] = useState('full_review')
  const [codeResult, setCodeResult] = useState(null)
  const [codeError, setCodeError] = useState(null)
  const [codeLoading, setCodeLoading] = useState(false)

  // ── Repo analysis state ───────────────────────────────────────────────────
  const [repoResult, setRepoResult] = useState(null)
  const [repoError, setRepoError] = useState(null)
  const [repoLoading, setRepoLoading] = useState(false)

  // ── Code analyze handler ───────────────────────────────────────────────────
  const handleAnalyzeCode = async () => {
    if (!code.trim()) return
    setCodeLoading(true)
    setCodeError(null)
    setCodeResult(null)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language, mode }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(extractErrorMessage(data.detail, `Server error: ${res.status}`))
      }

      const data = await res.json()
      setCodeResult({ ...data, mode })
    } catch (err) {
      setCodeError(err.message || 'An unexpected error occurred.')
    } finally {
      setCodeLoading(false)
    }
  }

  // ── Repo analyze handler ───────────────────────────────────────────────────
  const handleAnalyzeRepo = async (url) => {
    setRepoLoading(true)
    setRepoError(null)
    setRepoResult(null)

    try {
      const res = await fetch('/api/analyze-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(extractErrorMessage(data.detail, `Server error: ${res.status}`))
      }

      const data = await res.json()
      setRepoResult(data)
    } catch (err) {
      setRepoError(err.message || 'An unexpected error occurred.')
    } finally {
      setRepoLoading(false)
    }
  }

  const loading = activeTab === 'code' ? codeLoading : repoLoading

  return (
    <>
      {/* Star dust canvas — pure CSS stars, fades out in light mode */}
      <div className="star-canvas" aria-hidden="true" />

      <div className="app-shell">
        <Header theme={theme} onToggleTheme={toggleTheme} />

        {/* Segmented Navigation Bar */}
        <div className="nav-section">
          <div className="tab-segmented" role="tablist" aria-label="Analysis type">
            <button
              id="tab-code"
              type="button"
              role="tab"
              className={`tab-btn ${activeTab === 'code' ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab('code')}
              disabled={loading}
              aria-selected={activeTab === 'code'}
            >
              <Code2 size={15} aria-hidden="true" />
              <span>Code Input</span>
            </button>

            <button
              id="tab-repo"
              type="button"
              role="tab"
              className={`tab-btn ${activeTab === 'repo' ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab('repo')}
              disabled={loading}
              aria-selected={activeTab === 'repo'}
            >
              <GithubIcon size={15} aria-hidden="true" />
              <span>Repository</span>
            </button>
          </div>
        </div>

        <main className="app-main">
          {activeTab === 'code' ? (
            <>
              <CodeEditor
                code={code}
                language={language}
                mode={mode}
                onCodeChange={setCode}
                onLanguageChange={setLanguage}
                onModeChange={setMode}
                onAnalyze={handleAnalyzeCode}
                loading={codeLoading}
              />
              <AnalysisResult
                result={codeResult}
                error={codeError}
                loading={codeLoading}
                onDismissError={() => setCodeError(null)}
              />
            </>
          ) : (
            <>
              {/* Left: Repo URL input panel */}
              <div className="panel editor-panel">
                <div className="panel-header">
                  <span className="panel-title">
                    <GithubIcon size={15} aria-hidden="true" />
                    <span>GitHub Repository</span>
                  </span>
                  <span className="panel-badge">Public Only</span>
                </div>
                <div className="repo-panel-body">
                  <RepoInput onAnalyze={handleAnalyzeRepo} loading={repoLoading} />
                </div>
              </div>

              {/* Right: Results panel */}
              <div className="panel results-panel">
                <div className="panel-header">
                  <span className="panel-title">
                    <span>Repository Report</span>
                  </span>
                  {repoResult && (
                    <span className="panel-badge" style={{ color: 'var(--accent-text)' }}>
                      {repoResult.files_analyzed} files analyzed
                    </span>
                  )}
                </div>

                {/* Error Banner */}
                {repoError && (
                  <div className="error-banner" role="alert">
                    <span className="error-banner-icon" aria-hidden="true">
                      <AlertCircle size={16} />
                    </span>
                    <div className="error-banner-body">
                      <div className="error-banner-title">Repository Analysis Failed</div>
                      <div className="error-banner-message">{repoError}</div>
                    </div>
                    <button
                      className="error-banner-close"
                      onClick={() => setRepoError(null)}
                      aria-label="Dismiss error"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Loading State */}
                {repoLoading && (
                  <div className="loading-state" role="status" aria-live="polite">
                    <div className="loading-spinner-wrap">
                      <div className="sparkle-cluster">
                        <span className="sparkle-dot" />
                        <span className="sparkle-dot" />
                        <span className="sparkle-dot" />
                        <span className="sparkle-dot" />
                        <span className="sparkle-cluster-ring" />
                        <span className="sparkle-cluster-ring-outer" />
                        <span className="sparkle-cluster-halo" />
                        <Loader2 size={26} className="animate-spin" />
                      </div>
                    </div>
                    <div className="loading-title">Analyzing repository...</div>
                    <div className="loading-subtitle">
                      Fetching structure and understanding the codebase.
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {!repoLoading && !repoResult && !repoError && (
                  <div className="results-empty" role="status">
                    <div className="empty-state-icon">
                      <GithubIcon size={24} />
                    </div>
                    <div className="empty-state-title">Explore a repository</div>
                    <p className="empty-state-desc">
                      Paste a public GitHub URL to analyze its architecture, tech stack, and code quality.
                    </p>
                    <div className="sparkle-decoration" aria-hidden="true">
                      <Sparkles size={12} />
                      <Sparkles size={12} />
                      <Sparkles size={12} />
                    </div>
                  </div>
                )}

                {/* Result Meta */}
                {!repoLoading && repoResult && (
                  <RepoMeta result={repoResult} />
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </>
  )
}
