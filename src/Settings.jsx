import { useEffect, useRef, useState } from 'react'
import AuthPanel from './Auth.jsx'

const ACCENT_PRESETS = ['#96620e', '#b45309', '#a34a3a', '#4c7a48', '#2563a8', '#7c3aed']
const SAGE_PRESETS = ['#4c7a48', '#3f6b3c', '#74ae69', '#2f7d68', '#3d73a8', '#687f42']

function ColorPicker({ label, value, presets, onChange }) {
  return (
    <div className="color-picker">
      <span className="settings-hint">{label}</span>
      <div className="accent-controls">
        <div className="accent-presets" aria-label={`${label} presets`}>
          {presets.map((color) => (
            <button
              key={color}
              type="button"
              className={`accent-swatch ${value.toLowerCase() === color ? 'selected' : ''}`}
              style={{ '--swatch-color': color }}
              onClick={() => onChange(color)}
              aria-label={`Use ${color} for ${label.toLowerCase()}`}
              aria-pressed={value.toLowerCase() === color}
            />
          ))}
        </div>
        <label className="accent-custom" title={`Choose a custom ${label.toLowerCase()}`}>
          <span>custom</span>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={`Choose a custom ${label.toLowerCase()}`}
          />
        </label>
      </div>
    </div>
  )
}

export default function Settings({
  theme,
  onToggleTheme,
  accent,
  onAccentChange,
  sage,
  onSageChange,
  session,
  configured,
  authLoading,
  displayName,
  onSaveName,
}) {
  const [open, setOpen] = useState(false)
  const [draftName, setDraftName] = useState(displayName || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [nameError, setNameError] = useState('')
  const wrapperRef = useRef(null)

  useEffect(() => {
    setDraftName(displayName || '')
  }, [displayName])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  async function handleSaveName(e) {
    e.preventDefault()
    const trimmed = draftName.trim()
    if (!trimmed) return
    setSaving(true)
    setSaved(false)
    setNameError('')
    try {
      const { error } = await onSaveName(trimmed)
      if (error) {
        console.error('Failed to save display name:', error)
        setNameError(typeof error === 'string' ? error : error.message || 'Could not save your name.')
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      }
    } catch (err) {
      console.error('Failed to save display name:', err)
      setNameError(err.message || 'Could not save your name.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-widget" ref={wrapperRef}>
      <button
        className="settings-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
        title="Settings"
      >
        ⚙
      </button>

      {open && (
        <div className="settings-panel">
          <div className="settings-panel-header">
            <span>Settings</span>
            <button className="chat-close" onClick={() => setOpen(false)} aria-label="Close settings">
              ✕
            </button>
          </div>

          {!authLoading && (
            <AuthPanel session={session} configured={configured} displayName={displayName} variant="settings" />
          )}

          <div className="settings-section">
            <span className="settings-label">Appearance</span>
            <button className="settings-theme-btn" onClick={onToggleTheme}>
              {theme === 'light' ? '☾ Switch to dark' : '☀ Switch to light'}
            </button>
            <ColorPicker label="Primary color" value={sage} presets={SAGE_PRESETS} onChange={onSageChange} />
            <ColorPicker label="Accent color" value={accent} presets={ACCENT_PRESETS} onChange={onAccentChange} />
          </div>

          {configured && session && (
            <div className="settings-section">
              <span className="settings-label">Display name</span>
              <form className="settings-name-form" onSubmit={handleSaveName}>
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  maxLength={80}
                  placeholder="your name"
                />
                <button type="submit" disabled={saving || !draftName.trim()}>
                  {saving ? '...' : saved ? 'saved' : 'save'}
                </button>
              </form>
              <span className="settings-hint">Shown instead of your email when signed in.</span>
              {nameError && <p className="settings-error">{nameError}</p>}
            </div>
          )}

          {configured && !session && (
            <div className="settings-section">
              <span className="settings-label">Display name</span>
              <span className="settings-hint">Sign in to set a display name.</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
