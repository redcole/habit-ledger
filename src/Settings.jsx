import { useEffect, useRef, useState } from 'react'

export default function Settings({ theme, onToggleTheme, session, configured, displayName, onSaveName }) {
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

          <div className="settings-section">
            <span className="settings-label">Appearance</span>
            <button className="settings-theme-btn" onClick={onToggleTheme}>
              {theme === 'light' ? '☾ Switch to dark' : '☀ Switch to light'}
            </button>
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
