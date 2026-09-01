import { useState } from 'react'
import {
  FileText,
  Bug,
  Shield,
  CheckCircle2,
  Wand2,
  Code2,
  FlaskConical,
  BookOpen,
  ChevronDown,
  Copy,
  Check,
  AlertCircle,
  X,
} from 'lucide-react'

/* ── Severity Badge Parser ─────────────────────────────────────────────────── */
function parseSeverity(text) {
  if (typeof text !== 'string') return { severity: null, cleanText: text }
  const match = text.match(/^(?:\[?(CRITICAL|HIGH|MEDIUM|LOW)\]?[:\s-]*|\((CRITICAL|HIGH|MEDIUM|LOW)\)[:\s-]*)/i)
  if (match) {
    const sev = (match[1] || match[2]).toLowerCase()
    const cleanText = text.replace(match[0], '').trim()
    return { severity: sev, cleanText }
  }
  return { severity: null, cleanText: text }
}

/* ── Collapsible section card ─────────────────────────────────────────────── */
function Section({ variant, icon: IconComponent, label, count, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`result-section section--${variant}`}>
      <div
        className="result-section-header"
        onClick={() => setOpen((o) => !o)}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen((o) => !o)}
      >
        <span className="section-icon-wrap" aria-hidden="true">
          <IconComponent size={16} strokeWidth={2} />
        </span>
        <div className="section-label">
          <span>{label}</span>
          {count != null && (
            <span className="section-count-badge">{count}</span>
          )}
        </div>
        <span className={`section-chevron ${open ? 'section-chevron--open' : ''}`} aria-hidden="true">
          <ChevronDown size={15} />
        </span>
      </div>
      {open && <div className="result-section-body">{children}</div>}
    </div>
  )
}

/* ── Bullet list with severity support ─────────────────────────────────────── */
function BulletList({ items }) {
  if (!items || items.length === 0) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None detected.</p>
  }
  return (
    <ul className="result-list" role="list">
      {items.map((item, i) => {
        const { severity, cleanText } = parseSeverity(item)
        return (
          <li key={i} className="result-list-item">
            <span className="result-list-bullet" aria-hidden="true">
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
            </span>
            <div className="result-list-content">
              <span>
                {severity && (
                  <span className={`severity-tag severity--${severity}`}>
                    {severity}
                  </span>
                )}
                {cleanText}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* ── Copy button ──────────────────────────────────────────────────────────── */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button className="btn-copy" onClick={copy} aria-label="Copy code to clipboard">
      {copied ? (
        <>
          <Check size={12} color="var(--color-success)" />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Copy size={12} />
          <span>Copy</span>
        </>
      )}
    </button>
  )
}

/* ── Mode-aware section configuration ─────────────────────────────────────── */
const MODE_SECTIONS = {
  full_review:       null,
  bug_detection:     ['summary', 'bugs', 'improved_code'],
  security_analysis: ['summary', 'security', 'improved_code'],
  code_explanation:  ['summary', 'quality'],
  refactoring:       ['summary', 'quality', 'refactoring', 'improved_code'],
  test_generation:   ['summary', 'bugs', 'improved_code'],
}

const MODE_LABELS = {
  code_explanation: { quality: { icon: BookOpen, label: 'Code Explanation' } },
  test_generation:  { improved_code: { icon: FlaskConical, label: 'Generated Unit Tests' } },
  refactoring:      { improved_code: { icon: Wand2, label: 'Refactored Code' } },
  bug_detection:    { improved_code: { icon: Bug, label: 'Corrected Code' } },
  security_analysis:{ improved_code: { icon: Shield, label: 'Hardened Code' } },
}

export default function AnalysisResult({ result, error, loading, onDismissError }) {
  const mode = result?.mode || 'full_review'
  const visibleSections = MODE_SECTIONS[mode] ?? null
  const modeLabels = MODE_LABELS[mode] ?? {}

  const show = (key) => visibleSections === null || visibleSections.includes(key)

  return (
    <section className="panel results-panel" aria-label="Analysis output">
      <div className="panel-header">
        <span className="panel-title">
          <span>Analysis Results</span>
        </span>
        {result && (
          <span className="panel-badge" style={{ color: 'var(--color-success)', borderColor: 'var(--color-success-border)' }}>
            Complete
          </span>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="error-banner" role="alert">
          <span className="error-banner-icon" aria-hidden="true">
            <AlertCircle size={16} />
          </span>
          <div className="error-banner-body">
            <div className="error-banner-title">Analysis Failed</div>
            <div className="error-banner-message">{error}</div>
          </div>
          {onDismissError && (
            <button
              className="error-banner-close"
              onClick={onDismissError}
              aria-label="Dismiss error"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="results-loading" role="status" aria-live="polite">
          <div className="magical-orb-container">
            <div className="magical-orb" />
            <div className="magical-ring-1" />
            <div className="magical-ring-2" />
            <div className="magical-sparkles">
              <span className="sparkle-dot" />
              <span className="sparkle-dot" />
              <span className="sparkle-dot" />
              <span className="sparkle-dot" />
            </div>
          </div>
          <div className="loading-title">Analyzing your code...</div>
          <div className="loading-subtitle">Looking for bugs, security issues and improvements.</div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !result && !error && (
        <div className="results-empty" role="status">
          <div className="empty-state-icon-wrapper">
            <div className="empty-state-icon">
              <Code2 size={32} strokeWidth={1.75} />
            </div>
            <div className="empty-state-sparkles" aria-hidden="true">
              <span className="sparkle-dot" />
              <span className="sparkle-dot" />
              <span className="sparkle-dot" />
            </div>
          </div>
          <div className="empty-state-title">Ready when you are</div>
          <p className="empty-state-desc">
            Paste your code, choose an analysis mode, and let CodeLens take a look.
          </p>
        </div>
      )}

      {/* Results Content */}
      {!loading && result && (
        <div className="results-content">
          {show('summary') && result.summary && (
            <Section variant="summary" icon={FileText} label="Summary" defaultOpen={true}>
              <p>{result.summary}</p>
            </Section>
          )}

          {show('bugs') && result.bugs?.length > 0 && (
            <Section
              variant="bugs"
              icon={Bug}
              label="Bugs & Issues"
              count={result.bugs.length}
              defaultOpen={true}
            >
              <BulletList items={result.bugs} />
            </Section>
          )}

          {show('security') && result.security?.length > 0 && (
            <Section
              variant="security"
              icon={Shield}
              label="Security Findings"
              count={result.security.length}
              defaultOpen={true}
            >
              <BulletList items={result.security} />
            </Section>
          )}

          {show('quality') && result.quality?.length > 0 && (
            <Section
              variant="quality"
              icon={modeLabels.quality?.icon ?? CheckCircle2}
              label={modeLabels.quality?.label ?? 'Code Quality'}
              count={mode === 'code_explanation' ? undefined : result.quality.length}
              defaultOpen={true}
            >
              <BulletList items={result.quality} />
            </Section>
          )}

          {show('refactoring') && result.refactoring?.length > 0 && (
            <Section
              variant="refactor"
              icon={Wand2}
              label="Refactoring Recommendations"
              count={result.refactoring.length}
              defaultOpen={true}
            >
              <BulletList items={result.refactoring} />
            </Section>
          )}

          {show('improved_code') &&
            result.improved_code &&
            !['No changes needed.', 'No bugs found.', 'No security issues found.', ''].includes(result.improved_code) && (
            <Section
              variant="code"
              icon={modeLabels.improved_code?.icon ?? Code2}
              label={modeLabels.improved_code?.label ?? 'Improved Code'}
              defaultOpen={true}
            >
              <div className="code-preview-card">
                <div className="code-preview-header">
                  <span className="code-preview-tag">Source Preview</span>
                  <CopyButton text={result.improved_code} />
                </div>
                <pre className="code-preview-pre"><code>{result.improved_code}</code></pre>
              </div>
            </Section>
          )}
        </div>
      )}
    </section>
  )
}
