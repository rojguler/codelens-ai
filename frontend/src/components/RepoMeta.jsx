import { useState } from 'react'
import {
  Star,
  GitFork,
  Code2,
  Scale,
  FolderCode,
  FileText,
  Layers,
  Boxes,
  CheckCircle2,
  Bug,
  Shield,
  Lightbulb,
  ChevronDown,
  FileCode,
  Folder,
} from 'lucide-react'
import GithubIcon from './GithubIcon.jsx'

const SECTIONS = [
  {
    key: 'overview',
    label: 'Repository Overview',
    icon: FileText,
    colorClass: 'section--summary',
    isList: false,
  },
  {
    key: 'architecture',
    label: 'Architecture & Design',
    icon: Layers,
    colorClass: 'section--refactor',
    isList: false,
  },
  {
    key: 'tech_stack',
    label: 'Technologies Detected',
    icon: Boxes,
    colorClass: 'section--quality',
    isList: true,
  },
  {
    key: 'strengths',
    label: 'Architectural Strengths',
    icon: CheckCircle2,
    colorClass: 'section--quality',
    isList: true,
  },
  {
    key: 'issues',
    label: 'Concerns & Smells',
    icon: Bug,
    colorClass: 'section--bugs',
    isList: true,
  },
  {
    key: 'security',
    label: 'Security & Exposure',
    icon: Shield,
    colorClass: 'section--security',
    isList: true,
  },
  {
    key: 'recommendations',
    label: 'Recommendations',
    icon: Lightbulb,
    colorClass: 'section--refactor',
    isList: true,
  },
]

function MetaBadge({ icon: IconComponent, label, value }) {
  if (!value && value !== 0) return null
  return (
    <div className="repo-meta-badge" title={label}>
      <span className="repo-meta-badge-icon" aria-hidden="true">
        <IconComponent size={13} />
      </span>
      <span className="repo-meta-badge-value">{value}</span>
    </div>
  )
}

function RepoSection({ section, data }) {
  const [open, setOpen] = useState(true)
  const isEmpty = section.isList
    ? !data || data.length === 0
    : !data || !data.trim()

  if (isEmpty) return null

  const IconComponent = section.icon

  return (
    <div className={`result-section ${section.colorClass}`}>
      <div
        className="result-section-header"
        onClick={() => setOpen((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="section-icon-wrap" aria-hidden="true">
          <IconComponent size={15} />
        </span>
        <div className="section-label">
          <span>{section.label}</span>
          {section.isList && (
            <span className="section-count-badge">{data.length}</span>
          )}
        </div>
        <span className={`section-chevron ${open ? 'section-chevron--open' : ''}`} aria-hidden="true">
          <ChevronDown size={14} />
        </span>
      </div>

      {open && (
        <div className="result-section-body">
          {section.isList ? (
            section.key === 'tech_stack' ? (
              <div className="tech-stack-chips">
                {data.map((item, i) => (
                  <span key={i} className="tech-chip">{item}</span>
                ))}
              </div>
            ) : (
              <ul className="result-list">
                {data.map((item, i) => (
                  <li key={i} className="result-list-item">
                    <span className="result-list-bullet" aria-hidden="true">
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                    </span>
                    <div className="result-list-content">
                      <span>{item}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <p style={{ lineHeight: 1.6 }}>{data}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function RepoMeta({ result }) {
  if (!result) return null

  return (
    <div className="results-content">
      {/* Repository Header Card */}
      <div className="repo-header-card">
        <div className="repo-header-top">
          <div className="repo-header-icon" aria-hidden="true">
            <GithubIcon size={18} />
          </div>
          <div className="repo-header-info">
            <h2 className="repo-full-name">{result.full_name}</h2>
            {result.description && (
              <p className="repo-description">{result.description}</p>
            )}
          </div>
        </div>

        <div className="repo-meta-row">
          <MetaBadge icon={Star} label="Stars" value={result.stars?.toLocaleString()} />
          <MetaBadge icon={GitFork} label="Forks" value={result.forks?.toLocaleString()} />
          {result.language && (
            <MetaBadge icon={Code2} label="Primary Language" value={result.language} />
          )}
          {result.license && (
            <MetaBadge icon={Scale} label="License" value={result.license} />
          )}
          <MetaBadge
            icon={FolderCode}
            label="Analyzed Files"
            value={`${result.files_analyzed} of ${result.files_total} files`}
          />
        </div>
      </div>

      {/* Analysis Sections */}
      {SECTIONS.map((section) => (
        <RepoSection
          key={section.key}
          section={section}
          data={result[section.key]}
        />
      ))}

      {/* Files List */}
      {result.files_list?.length > 0 && (
        <details className="files-details">
          <summary className="files-summary">
            <Folder size={14} aria-hidden="true" />
            <span>Files Included in Analysis ({result.files_list.length})</span>
          </summary>
          <ul className="files-list">
            {result.files_list.map((f) => (
              <li key={f} className="files-list-item">
                <FileCode size={13} className="file-icon" aria-hidden="true" />
                <code>{f}</code>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
