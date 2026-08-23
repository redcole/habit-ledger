import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function AuthPanel({ session, configured }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  // ---------- profile (real name) ----------

  const [profile, setProfile] = useState(null)
  const [isEditingName, setIsEditingName] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [savingName, setSavingName] = useState(false)

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    let cancelled = false
    supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProfile(data)
      })
    return () => {
      cancelled = true
    }
  }, [session])

  const displayName = profile?.full_name || session?.user.email

  function startEditingName() {
    setDraftName(profile?.full_name || '')
    setIsEditingName(true)
  }

  function cancelEditingName() {
    setIsEditingName(false)
  }

  async function saveName(e) {
    e.preventDefault()
    const trimmed = draftName.trim()
    if (!trimmed || !session) return
    setSavingName(true)
    const { data, error: saveError } = await supabase
      .from('profiles')
      .upsert({ user_id: session.user.id, full_name: trimmed, updated_at: new Date().toISOString() })
      .select('full_name')
      .single()
    setSavingName(false)
    if (!saveError && data) {
      setProfile(data)
      setIsEditingName(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)

    const { error: authError } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName.trim() } },
          })

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    if (mode === 'signup') {
      setInfo('Account created. Check your email to confirm it, then sign in.')
      setFullName('')
    } else {
      setOpen(false)
      setEmail('')
      setPassword('')
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  if (!configured) {
    return (
      <div className="account-bar account-bar-disabled">
        <span className="account-status">
          Account sync isn't set up yet — add Supabase credentials to enable sign-in (see README).
        </span>
      </div>
    )
  }

  if (session) {
    return (
      <div className="account-bar">
        {isEditingName ? (
          <form className="account-name-form" onSubmit={saveName}>
            <span className="account-status">
              <span className="account-dot" /> Signed in as
            </span>
            <input
              className="account-name-input"
              type="text"
              value={draftName}
              autoFocus
              maxLength={80}
              placeholder="your name"
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && cancelEditingName()}
            />
            <button className="account-link-btn" type="submit" disabled={savingName || !draftName.trim()}>
              {savingName ? '...' : 'save'}
            </button>
            <button type="button" className="account-link-btn" onClick={cancelEditingName}>
              cancel
            </button>
          </form>
        ) : (
          <span className="account-status">
            <span className="account-dot" /> Signed in as <strong>{displayName}</strong>
            <button
              className="edit-btn account-edit-name-btn"
              onClick={startEditingName}
              aria-label="Edit your name"
              title="Edit your name"
            >
              ✎
            </button>
          </span>
        )}
        <button className="account-link-btn" onClick={handleSignOut}>
          sign out
        </button>
      </div>
    )
  }

  return (
    <div className="account-bar">
      {open ? (
        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="your name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              maxLength={80}
              required
            />
          )}
          <input
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            minLength={6}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? '...' : mode === 'signin' ? 'sign in' : 'sign up'}
          </button>
          <button
            type="button"
            className="account-link-btn"
            onClick={() => {
              setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
              setError('')
              setInfo('')
            }}
          >
            {mode === 'signin' ? 'need an account?' : 'have an account?'}
          </button>
          <button
            type="button"
            className="account-link-btn"
            onClick={() => {
              setOpen(false)
              setError('')
              setInfo('')
            }}
          >
            cancel
          </button>
          {error && <p className="auth-message auth-error">{error}</p>}
          {info && <p className="auth-message auth-info">{info}</p>}
        </form>
      ) : (
        <>
          <span className="account-status">
            Signed out — entries are saved to this browser only.
          </span>
          <button className="account-link-btn" onClick={() => setOpen(true)}>
            sign in to sync across devices
          </button>
        </>
      )}
    </div>
  )
}
