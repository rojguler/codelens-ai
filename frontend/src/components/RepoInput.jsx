import { useState } from 'react'
import { X, Info, ScanSearch, Loader2 } from 'lucide-react'
import GithubIcon from './GithubIcon.jsx'

export default function RepoInput({ onAnalyze, loading }) {
  const [url, setUrl] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!url.trim() || loading) return
    onAnalyze(url.trim())
  }

  const GITHUB_URL_PATTERN = /^(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+/i
  const isValidGithub = GITHUB_URL_PATTERN.test(url.trim())

  return (
    <form className="repo-input-form" onSubmit={handleSubmit} noValidate>
      <div className="repo-url-wrapper">
        <span className="repo-url-icon" aria-hidden="true">
          <GithubIcon size={16} />
        </span>
        <input
          id="repo-url-input"
          type="url"
          className="repo-url-input"
          placeholder="https://github.com/owner/repository"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
          autoComplete="off"
          spellCheck={false}
          aria-label="GitHub repository URL"
        />
        {url && (
          <button
            type="button"
            className="repo-url-clear"
            onClick={() => setUrl('')}
            aria-label="Clear repository URL"
            tabIndex={-1}
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="repo-hint">
        <Info size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
        <span>Supports public GitHub repositories. CodeLens inspects up to 20 key source files.</span>
      </div>

      <button
        id="repo-analyze-btn"
        type="submit"
        className="btn-cta"
        disabled={!url.trim() || !isValidGithub || loading}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {loading ? (
          <>
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            <span>Analyzing Repository...</span>
          </>
        ) : (
          <>
            <ScanSearch size={15} aria-hidden="true" />
            <span>Analyze Repository</span>
          </>
        )}
      </button>
    </form>
  )
}
