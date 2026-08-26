import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function AuthPanel({
  session,
  configured,
  displayName,
  variant = 'bar',
  passwordRecovery = false,
  onRecoveryComplete,
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    if (passwordRecovery) setShowPasswordForm(true)
  }, [passwordRecovery])

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

  async function handleForgotPassword() {
    setError('')
    setInfo('')
    if (!email.trim()) {
      setError('Enter your email address first.')
      return
    }
    setLoading(true)
    const redirectTo = `${window.location.origin}${window.location.pathname}`
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    })
    setLoading(false)
    if (resetError) {
      setError(resetError.message)
    } else {
      setInfo('If an account exists for that email, a password reset link has been sent.')
    }
  }

  async function handlePasswordUpdate(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setNewPassword('')
    setConfirmPassword('')
    setShowPasswordForm(false)
    setInfo('Password updated successfully.')
    if (passwordRecovery) {
      window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`)
      onRecoveryComplete?.()
    }
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
        <button
          className="account-link-btn"
          onClick={() => {
            setShowPasswordForm((shown) => !shown)
            setError('')
            setInfo('')
          }}
        >
          {showPasswordForm ? 'cancel password change' : 'change password'}
        </button>
        {showPasswordForm && (
          <form className="auth-form password-form" onSubmit={handlePasswordUpdate}>
            {passwordRecovery && <strong className="password-recovery-title">Choose a new password</strong>}
            <input
              type="password"
              placeholder="new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
            <input
              type="password"
              placeholder="confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
            <button type="submit" disabled={loading}>
              {loading ? '...' : 'update password'}
            </button>
          </form>
        )}
        {error && <p className="auth-message auth-error">{error}</p>}
        {info && <p className="auth-message auth-info">{info}</p>}
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
          {mode === 'signin' && (
            <button type="button" className="account-link-btn" onClick={handleForgotPassword} disabled={loading}>
              forgot password?
            </button>
          )}
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
