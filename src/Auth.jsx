import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function AuthPanel({ session, configured, displayName, variant = 'bar' }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

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

  const wrapperClass =
    variant === 'settings' ? 'settings-section settings-account' : 'account-bar'

  if (!configured) {
    return (
      <div className={`${wrapperClass}${variant === 'bar' ? ' account-bar-disabled' : ''}`}>
        {variant === 'settings' && <span className="settings-label">Account</span>}
        <span className="account-status">
          Account sync isn't set up yet — add Supabase credentials to enable sign-in (see README).
        </span>
      </div>
    )
  }

  if (session) {
    return (
      <div className={wrapperClass}>
        {variant === 'settings' && <span className="settings-label">Account</span>}
        <span className="account-status">
          <span className="account-dot" /> Signed in as{' '}
          <strong>{displayName || session.user.email}</strong>
        </span>
        <button className="account-link-btn" onClick={handleSignOut}>
          sign out
        </button>
      </div>
    )
  }

  return (
    <div className={wrapperClass}>
      {variant === 'settings' && <span className="settings-label">Account</span>}
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
