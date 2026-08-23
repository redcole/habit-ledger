import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
import AuthPanel from './Auth.jsx'
import Settings from './Settings.jsx'
import ImportBanner from './ImportBanner.jsx'
import ChatWidget from './ChatWidget.jsx'

const STORAGE_KEY = 'habit-ledger-v1'
const THEME_KEY = 'habit-ledger-theme'
const HEATMAP_DAYS = 70 // 10 weeks

// ---------- date helpers (local time, no UTC drift) ----------

function pad(n) {
  return String(n).padStart(2, '0')
}

function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function todayStr() {
  return toDateStr(new Date())
}

function addDays(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + delta)
  return toDateStr(dt)
}

function formatHeaderDate() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ---------- streak math ----------

function isDone(status) {
  return status === true
}

function isSkipped(status) {
  return status === 'skipped'
}

function currentStreak(completions, today) {
  let streak = 0
  let cursor = today
  // if today isn't marked yet, start counting from yesterday so an
  // unbroken streak doesn't visually reset to 0 before the day ends
  if (!isDone(completions[cursor])) {
    cursor = addDays(cursor, -1)
  }
  while (isDone(completions[cursor])) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

function bestStreak(completions) {
  const dates = Object.keys(completions).filter((d) => isDone(completions[d])).sort()
  if (dates.length === 0) return 0
  let best = 1
  let run = 1
  for (let i = 1; i < dates.length; i++) {
    if (addDays(dates[i - 1], 1) === dates[i]) {
      run += 1
    } else {
      run = 1
    }
    if (run > best) best = run
  }
  return best
}

// ---------- tally marks (signature element) ----------

function TallyGroup({ n }) {
  const positions = [2, 7, 12, 17]
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" className="tally-group">
      {positions.slice(0, Math.min(n, 4)).map((x) => (
        <line
          key={x}
          x1={x}
          y1={2}
          x2={x}
          y2={14}
          stroke="var(--amber)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      ))}
      {n === 5 && (
        <line
          x1={0}
          y1={14}
          x2={19}
          y2={2}
          stroke="var(--amber)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}

function TallyMarks({ count }) {
  if (count === 0) {
    return <span className="tally-label">no streak yet</span>
  }
  const fullGroups = Math.floor(count / 5)
  const remainder = count % 5
  const groups = Array(fullGroups).fill(5)
  if (remainder > 0) groups.push(remainder)

  return (
    <div className="tally">
      <div className="tally-groups">
        {groups.map((n, i) => (
          <TallyGroup key={i} n={n} />
        ))}
      </div>
      <span className="tally-count">{count}</span>
      <span className="tally-label">day{count === 1 ? '' : 's'}</span>
    </div>
  )
}

// ---------- heatmap strip ----------

function Heatmap({ completions, onToggleDate }) {
  const today = todayStr()
  const cells = []
  for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
    const dateStr = addDays(today, -i)
    const status = completions[dateStr]
    cells.push({
      dateStr,
      filled: isDone(status),
      skipped: isSkipped(status),
      isToday: dateStr === today,
    })
  }
  return (
    <div className="heatmap" aria-label="Habit history">
      {cells.map((c) => {
        const statusLabel = c.filled ? 'completed' : c.skipped ? 'skipped' : 'not completed'
        const label = `${c.dateStr}: ${statusLabel}${c.isToday ? ' (today)' : ''}`
        return (
          <button
            key={c.dateStr}
            type="button"
            className={`cell ${c.filled ? 'filled' : ''} ${c.skipped ? 'skipped' : ''} ${c.isToday ? 'today' : ''}`}
            title={label}
            aria-label={label}
            aria-pressed={c.filled}
            onClick={() => onToggleDate(c.dateStr)}
          />
        )
      })}
    </div>
  )
}

// ---------- habit row ----------

function HabitRow({
  habit,
  onToggleToday,
  onToggleSkipToday,
  onToggleDate,
  onDelete,
  onRename,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  isDragOver,
}) {
  const today = todayStr()
  const todayStatus = habit.completions[today]
  const doneToday = isDone(todayStatus)
  const skippedToday = isSkipped(todayStatus)
  const streak = useMemo(() => currentStreak(habit.completions, today), [habit.completions, today])
  const best = useMemo(() => bestStreak(habit.completions), [habit.completions])

  const [isEditing, setIsEditing] = useState(false)
  const [draftName, setDraftName] = useState(habit.name)

  function startEditing() {
    setDraftName(habit.name)
    setIsEditing(true)
  }

  function commitEdit() {
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== habit.name) {
      onRename(habit.id, trimmed)
    }
    setIsEditing(false)
  }

  function cancelEdit() {
    setDraftName(habit.name)
    setIsEditing(false)
  }

  function handleEditKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    }
  }

  return (
    <div
      className={`row ${isDragging ? 'row-dragging' : ''} ${isDragOver ? 'row-drag-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver(habit.id)
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDrop(habit.id)
      }}
    >
      <div className="row-top">
        <div className="row-heading-group">
          <span
            className="drag-handle"
            draggable
            onDragStart={() => onDragStart(habit.id)}
            onDragEnd={onDragEnd}
            aria-label="Drag to reorder"
            title="Drag to reorder"
          >
            ⠿
          </span>
          <div className="row-heading">
          {isEditing ? (
            <input
              className="row-name-input"
              type="text"
              value={draftName}
              autoFocus
              maxLength={60}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={handleEditKeyDown}
              onBlur={commitEdit}
            />
          ) : (
            <p className="row-name" onDoubleClick={startEditing}>
              {habit.name}
            </p>
          )}
          <div className="row-meta">
            <TallyMarks count={streak} />
            <span className="best">best {best}</span>
          </div>
          </div>
        </div>
        <div className="row-actions">
          {isEditing ? (
            <>
              <button className="mark-btn" onMouseDown={(e) => e.preventDefault()} onClick={commitEdit}>
                save
              </button>
              <button
                className="delete-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={cancelEdit}
                aria-label="Cancel edit"
                title="Cancel"
              >
                ✕
              </button>
            </>
          ) : (
            <>
              <button
                className={`mark-btn ${doneToday ? 'done' : ''}`}
                onClick={() => onToggleToday(habit.id)}
              >
                {doneToday ? '✓ done today' : 'mark today'}
              </button>
              <button
                className={`skip-btn ${skippedToday ? 'skipped' : ''}`}
                onClick={() => onToggleSkipToday(habit.id)}
              >
                {skippedToday ? '↺ unskip' : 'skip'}
              </button>
              <button className="edit-btn" onClick={startEditing} aria-label="Rename habit" title="Rename">
                ✎
              </button>
              <button className="delete-btn" onClick={() => onDelete(habit.id)} aria-label="Delete habit" title="Delete">
                ✕
              </button>
            </>
          )}
        </div>
      </div>
      <Heatmap completions={habit.completions} onToggleDate={(dateStr) => onToggleDate(habit.id, dateStr)} />
    </div>
  )
}

// ---------- add form ----------

function AddHabitForm({ onAdd }) {
  const [value, setValue] = useState('')

  function submit(e) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setValue('')
  }

  return (
    <form className="add-form" onSubmit={submit}>
      <input
        type="text"
        placeholder="Name a habit — read daily, stretch, no sugar..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={60}
      />
      <button type="submit" disabled={!value.trim()}>
        Add entry
      </button>
    </form>
  )
}

// ---------- app ----------

export default function App() {
  const configured = !!supabase

  // ---------- auth state ----------

  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(configured)

  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [configured])

  // ---------- profile (display name shown instead of email) ----------

  const [profile, setProfile] = useState(null)

  useEffect(() => {
    if (!configured || !session) {
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
  }, [configured, session])

  async function updateDisplayName(name) {
    if (!session) return { error: 'not signed in' }
    const trimmed = name.trim()
    if (!trimmed) return { error: 'empty name' }
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        { user_id: session.user.id, full_name: trimmed, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      .select('full_name')
      .single()
    if (error) {
      console.error('Failed to save display name:', error)
    } else if (data) {
      setProfile(data)
    }
    return { error }
  }

  // ---------- habit state (local guest storage OR remote account storage) ----------

  const [habits, setHabits] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })
  const [habitsLoading, setHabitsLoading] = useState(false)
  const [importCandidates, setImportCandidates] = useState([])
  const [importing, setImporting] = useState(false)
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)

  // Guest mode: persist to localStorage. Skipped once signed in, since data
  // lives in Supabase at that point instead.
  useEffect(() => {
    if (session) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(habits))
    } catch {
      // storage unavailable — fail silently, app still works in-session
    }
  }, [habits, session])

  // Load the right data source whenever auth state changes.
  useEffect(() => {
    if (!configured) return

    if (session) {
      loadRemoteHabits()
    } else if (!authLoading) {
      // signed out (including right after sign-out) — fall back to whatever
      // is in this browser's local storage
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        setHabits(raw ? JSON.parse(raw) : [])
      } catch {
        setHabits([])
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  async function loadRemoteHabits() {
    setHabitsLoading(true)
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .order('position', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })

    if (!error && data) {
      const loaded = data.map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        completions: row.completions || {},
      }))
      setHabits(loaded)

      // Rows created before drag-to-reorder existed have a null position —
      // assign sequential positions matching their current (created_at)
      // order the first time we see them, so reordering has something to
      // work with everywhere it's opened.
      const needsBackfill = data.some((row) => row.position === null || row.position === undefined)
      if (needsBackfill) {
        persistOrder(loaded)
      }
    }
    setHabitsLoading(false)

    // Offer to migrate any pre-sign-in local habits into the account.
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const local = raw ? JSON.parse(raw) : []
      if (local.length > 0) setImportCandidates(local)
    } catch {
      // ignore
    }
  }

  async function persistOrder(orderedHabits) {
    await Promise.all(
      orderedHabits.map((h, idx) => supabase.from('habits').update({ position: idx }).eq('id', h.id))
    )
  }

  async function importLocalHabits() {
    if (!session || importCandidates.length === 0) return
    setImporting(true)
    const rows = importCandidates.map((h) => ({
      user_id: session.user.id,
      name: h.name,
      completions: h.completions || {},
    }))
    const { data, error } = await supabase.from('habits').insert(rows).select()
    setImporting(false)
    if (!error && data) {
      setHabits((prev) => [
        ...prev,
        ...data.map((row) => ({
          id: row.id,
          name: row.name,
          createdAt: row.created_at,
          completions: row.completions || {},
        })),
      ])
      localStorage.removeItem(STORAGE_KEY)
      setImportCandidates([])
    }
  }

  function dismissImport() {
    // The offer was declined — clear the leftover guest-mode data so this
    // banner doesn't reappear next time the account habits load. The
    // account's own habits (already loaded into `habits`) are untouched.
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    setImportCandidates([])
  }

  // ---------- theme ----------

  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY)
      if (stored === 'light' || stored === 'dark') return stored
    } catch {
      // ignore
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // storage unavailable — theme still applies for this session
    }
  }, [theme])

  function toggleTheme() {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  }

  // ---------- habit CRUD (branches on signed-in vs guest) ----------

  async function addHabit(name) {
    if (session) {
      const { data, error } = await supabase
        .from('habits')
        .insert({ user_id: session.user.id, name, completions: {}, position: habits.length })
        .select()
        .single()
      if (!error && data) {
        setHabits((prev) => [
          ...prev,
          { id: data.id, name: data.name, createdAt: data.created_at, completions: data.completions || {} },
        ])
      }
      return
    }
    setHabits((prev) => [
      ...prev,
      {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        name,
        createdAt: todayStr(),
        completions: {},
      },
    ])
  }

  async function toggleDate(id, dateStr) {
    const habit = habits.find((h) => h.id === id)
    if (!habit) return
    const completions = { ...habit.completions }
    if (isDone(completions[dateStr])) {
      delete completions[dateStr]
    } else {
      completions[dateStr] = true
    }
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, completions } : h)))
    if (session) {
      await supabase.from('habits').update({ completions }).eq('id', id)
    }
  }

  async function toggleToday(id) {
    await toggleDate(id, todayStr())
  }

  async function toggleSkip(id, dateStr) {
    const habit = habits.find((h) => h.id === id)
    if (!habit) return
    const completions = { ...habit.completions }
    if (isSkipped(completions[dateStr])) {
      delete completions[dateStr]
    } else {
      completions[dateStr] = 'skipped'
    }
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, completions } : h)))
    if (session) {
      await supabase.from('habits').update({ completions }).eq('id', id)
    }
  }

  async function toggleSkipToday(id) {
    await toggleSkip(id, todayStr())
  }

  async function deleteHabit(id) {
    setHabits((prev) => prev.filter((h) => h.id !== id))
    if (session) {
      await supabase.from('habits').delete().eq('id', id)
    }
  }

  async function renameHabit(id, newName) {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, name: newName } : h)))
    if (session) {
      await supabase.from('habits').update({ name: newName }).eq('id', id)
    }
  }

  // ---------- drag-to-reorder ----------

  function handleDragStart(id) {
    setDragId(id)
  }

  function handleDragOver(id) {
    if (id !== overId) setOverId(id)
  }

  function handleDragEnd() {
    setDragId(null)
    setOverId(null)
  }

  function handleDrop(targetId) {
    if (!dragId || dragId === targetId) {
      setDragId(null)
      setOverId(null)
      return
    }
    const fromIdx = habits.findIndex((h) => h.id === dragId)
    const toIdx = habits.findIndex((h) => h.id === targetId)
    setDragId(null)
    setOverId(null)
    if (fromIdx === -1 || toIdx === -1) return

    const reordered = [...habits]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    setHabits(reordered)

    if (session) {
      persistOrder(reordered)
    }
  }

  return (
    <div className="app">
      <div className="header">
        <h1>Habit Ledger</h1>
        <div className="header-right">
          <span className="date">
            <span className="dot">●</span> {formatHeaderDate()}
          </span>
          <Settings
            theme={theme}
            onToggleTheme={toggleTheme}
            session={session}
            configured={configured}
            displayName={profile?.full_name || ''}
            onSaveName={updateDisplayName}
          />
        </div>
      </div>
      <p className="subhead">a running tally of what you show up for</p>

      {!authLoading && (
        <AuthPanel
          session={session}
          configured={configured}
          displayName={profile?.full_name || session?.user.email}
        />
      )}

      {importCandidates.length > 0 && (
        <ImportBanner
          count={importCandidates.length}
          onImport={importLocalHabits}
          onDismiss={dismissImport}
          importing={importing}
        />
      )}

      <AddHabitForm onAdd={addHabit} />
      <hr className="rule" />

      {habitsLoading ? (
        <div className="empty">
          <strong>Loading your habits...</strong>
        </div>
      ) : habits.length === 0 ? (
        <div className="empty">
          <strong>The ledger is empty.</strong>
          Add your first habit above — every day you mark it, the tally grows.
        </div>
      ) : (
        <div className="rows">
          {habits.map((h) => (
            <HabitRow
              key={h.id}
              habit={h}
              onToggleToday={toggleToday}
              onToggleSkipToday={toggleSkipToday}
              onToggleDate={toggleDate}
              onDelete={deleteHabit}
              onRename={renameHabit}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              isDragging={dragId === h.id}
              isDragOver={overId === h.id && dragId !== h.id}
            />
          ))}
        </div>
      )}

      <div className="footer">
        {session
          ? `synced to your account · ${habits.length} habit${habits.length === 1 ? '' : 's'} tracked`
          : `entries saved to this browser only · ${habits.length} habit${habits.length === 1 ? '' : 's'} tracked`}
      </div>

      <ChatWidget session={session} configured={configured} />
    </div>
  )
}
