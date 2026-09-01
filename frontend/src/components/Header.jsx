import { Code2, Sun, Moon } from 'lucide-react'

export default function Header({ theme, onToggleTheme }) {
  const isDark = theme === 'dark'

  return (
    <header className="header">
      <div className="header-left">
        <div className="header-logo-badge" aria-hidden="true">
          <Code2 size={18} strokeWidth={2.2} />
        </div>
        <div className="header-titles">
          <div className="header-title-row">
            <span className="header-title">CodeLens</span>
            <span className="header-version">v1.0</span>
          </div>
          <span className="header-subtitle">AI Developer Assistant</span>
        </div>
      </div>

      <div className="header-right">
        <div className="header-status" title="Active LLM Engine">
          <span className="header-status-dot" />
          <span>Gemini 2.5 Flash</span>
        </div>

        <button
          id="theme-toggle"
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  )
}
