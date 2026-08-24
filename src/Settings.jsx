import { useEffect, useRef, useState } from 'react'

export default function Settings({
  theme,
  onToggleTheme,
  session,
  configured,
  displayName,
  onSaveName,
  username,
  onSaveUsername,
  onViewProfile,
}) {
  const [open, setOpen] = useState(false)
  const [draftName, setDraftName] = useState(displayName || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [nameError, setNameError] = useState('')
  const wrapperRef = useRef(null)

  const [draftUsername, setDraftUsername] = useState(username || '')
  const [savingUsername, setSavingUsername] = useState(false)
  const [savedUsername, setSavedUsername] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setDraftName(displayName || '')
  }, [displayName])

  useEffect(() => {
    setDraftUsername(username || '')
  }, [username])

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

  async function handleSaveUsername(e) {
    e.preventDefault()
    const trimmed = draftUsername.trim()
    if (!trimmed) return
    setSavingUsername(true)
    setSavedUsername(false)
    setUsernameError('')
    try {
      const { error } = await onSaveUsername(trimmed)
      if (error) {
        console.error('Failed to save username:', error)
        setUsernameError(typeof error === 'string' ? error : error.message || 'Could not save your username.')
      } else {
        setSavedUsername(true)
        setTimeout(() => setSavedUsername(false), 1500)
      }
    } catch (err) {
      console.error('Failed to save username:', err)
      setUsernameError(err.message || 'Could not save your username.')
    } finally {
      setSavingUsername(false)
    }
  }

  function handleCopyLink() {
    const url = `${window.location.origin}/u/${username}`
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
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

          {configured && session && (
            <div className="settings-section">
              <span className="settings-label">Public profile</span>
              <form className="settings-name-form" onSubmit={handleSaveUsername}>
                <input
                  type="text"
                  value={draftUsername}
                  onChange={(e) => setDraftUsername(e.target.value.toLowerCase())}
                  maxLength={24}
                  placeholder="username"
                />
                <button type="submit" disabled={savingUsername || !draftUsername.trim()}>
                  {savingUsername ? '...' : savedUsername ? 'saved' : 'save'}
                </button>
              </form>
              {username ? (
                <div className="settings-profile-link">
                  <button className="settings-link-btn" onClick={() => onViewProfile(username)}>
                    /u/{username}
                  </button>
                  <button className="settings-link-btn" onClick={handleCopyLink}>
                    {copied ? 'copied' : 'copy link'}
                  </button>
                </div>
              ) : (
                <span className="settings-hint">
                  Claim a username to get a public page showing your public habits and streaks.
                </span>
              )}
              {usernameError && <p className="settings-error">{usernameError}</p>}
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
