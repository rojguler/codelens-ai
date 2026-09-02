import { useRef } from 'react'
import {
  ScanSearch,
  Bug,
  Shield,
  BookOpen,
  Wand2,
  FlaskConical,
  Sparkles,
  RotateCcw,
} from 'lucide-react'

const LANGUAGES = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C', 'C++', 'C#',
  'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'SQL', 'Bash', 'Other',
]

const ANALYSIS_MODES = [
  {
    id: 'full_review',
    label: 'Full Code Review',
    icon: ScanSearch,
    description: 'Comprehensive review: bugs, security, quality & refactoring',
  },
  {
    id: 'bug_detection',
    label: 'Bug Detection',
    icon: Bug,
    description: 'Find runtime errors, logical flaws and edge cases',
  },
  {
    id: 'security_analysis',
    label: 'Security Analysis',
    icon: Shield,
    description: 'Audit vulnerabilities, injection risks and fixes',
  },
  {
    id: 'code_explanation',
    label: 'Code Explanation',
    icon: BookOpen,
    description: 'Walkthrough of algorithms and components',
  },
  {
    id: 'refactoring',
    label: 'Refactoring',
    icon: Wand2,
    description: 'Improve code structure and design patterns',
  },
  {
    id: 'test_generation',
    label: 'Test Generation',
    icon: FlaskConical,
    description: 'Generate unit tests for edge and happy paths',
  },
]

const PLACEHOLDER = `// Paste your code snippet here...

function calculateMetrics(records) {
  if (!records || records.length === 0) {
    return { total: 0, average: 0 };
  }
  const total = records.reduce((acc, curr) => acc + curr.value, 0);
  return { total, average: total / records.length };
}`

export default function CodeEditor({
  code,
  language,
  mode,
  onCodeChange,
  onLanguageChange,
  onModeChange,
  onAnalyze,
  loading,
}) {
  const gutterRef = useRef(null)
  const textareaRef = useRef(null)

  const charCount = code.length
  const isEmpty = !code.trim()

  const handleScroll = (e) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.target.scrollTop
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const { selectionStart, selectionEnd } = e.target
      const next = code.substring(0, selectionStart) + '  ' + code.substring(selectionEnd)
      onCodeChange(next)
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = selectionStart + 2
        }
      })
    }
  }

  return (
    <section className="panel editor-panel" aria-label="Code input workspace">
      <div className="panel-header">
        <span className="panel-title">
          <span>Source Code</span>
        </span>
        <span className="panel-badge">Editor</span>
      </div>

      {/* Mode Selector — auto-scrolling carousel */}
      <div className="mode-chips-container">
        <span className="mode-chips-label">Mode</span>
        <div className="mode-chips-track-wrapper">
          {/* Render chips twice for seamless infinite loop */}
          <div className="mode-chips-row" role="group" aria-label="Analysis mode options">
            {[...ANALYSIS_MODES, ...ANALYSIS_MODES].map((m, idx) => {
              const IconComponent = m.icon
              const isActive = mode === m.id
              const isFirst = idx < ANALYSIS_MODES.length
              return (
                <button
                  key={`${m.id}-${idx}`}
                  id={isFirst ? `mode-${m.id}` : undefined}
                  type="button"
                  className={`mode-chip ${isActive ? 'mode-chip--active' : ''}`}
                  onClick={() => onModeChange(m.id)}
                  disabled={loading}
                  aria-pressed={isFirst ? isActive : undefined}
                  aria-hidden={!isFirst}
                  tabIndex={isFirst ? 0 : -1}
                  title={m.description}
                >
                  <span className="mode-chip-icon">
                    <IconComponent size={14} strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="mode-chip-label">{m.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>


      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="lang-select-wrapper">
          <label htmlFor="language-select" className="sr-only">Programming language</label>
          <select
            id="language-select"
            className="lang-select"
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            disabled={loading}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>
        <span className="char-counter">
          {charCount.toLocaleString()} chars
        </span>
      </div>

      {/* Editor Workspace */}
      <div className="editor-workspace">
        <textarea
          ref={textareaRef}
          id="code-textarea"
          className="editor-textarea"
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          aria-label="Code editor"
        />
      </div>

      {/* Actions Footer */}
      <div className="editor-footer">
        <button
          id="analyze-btn"
          className="btn-cta"
          onClick={onAnalyze}
          disabled={loading || isEmpty}
          aria-busy={loading}
        >
          {loading ? (
            <>
              <Sparkles size={16} className="animate-sparkle" aria-hidden="true" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <Sparkles size={16} aria-hidden="true" />
              <span>Analyze Code</span>
            </>
          )}
        </button>

        <button
          id="clear-btn"
          type="button"
          className="btn-ghost"
          onClick={() => onCodeChange('')}
          disabled={loading || isEmpty}
          aria-label="Clear code editor"
        >
          <RotateCcw size={13} aria-hidden="true" />
          <span>Clear</span>
        </button>
      </div>
    </section>
  )
}
