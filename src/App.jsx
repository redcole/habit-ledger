import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import Settings from './Settings.jsx'
import ImportBanner from './ImportBanner.jsx'
import ChatWidget from './ChatWidget.jsx'

const STORAGE_KEY = 'habit-ledger-v1'
const THEME_KEY = 'habit-ledger-theme'
const ACCENT_KEY = 'habit-ledger-accent'
const SAGE_KEY = 'habit-ledger-sage'
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

function formatShortDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function currentWeekDates() {
  const today = todayStr()
  return Array.from({ length: 7 }, (_, index) => addDays(today, index - 6))
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
  if (!isDone(completions[cursor]) && !isSkipped(completions[cursor])) {
    cursor = addDays(cursor, -1)
  }
  // Skipped days bridge a streak without adding to its completed-day count.
  while (isDone(completions[cursor]) || isSkipped(completions[cursor])) {
    if (isDone(completions[cursor])) streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

function bestStreak(completions) {
  const dates = Object.keys(completions)
    .filter((d) => isDone(completions[d]) || isSkipped(completions[d]))
    .sort()
  if (dates.length === 0) return 0
  let best = 0
  let run = 0
  let previousDate = null
  for (const date of dates) {
    if (previousDate && addDays(previousDate, 1) !== date) run = 0
    if (isDone(completions[date])) run += 1
    if (run > best) best = run
    previousDate = date
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
  const visibleCount = Math.min(count, 10)
  const fullGroups = Math.floor(visibleCount / 5)
  const remainder = visibleCount % 5
  const groups = Array(fullGroups).fill(5)
  if (remainder > 0) groups.push(remainder)

  return (
    <div className="tally" title={`${count}-day streak`}>
      <div className="tally-groups" aria-hidden="true">
        {groups.map((n, i) => (
          <TallyGroup key={i} n={n} />
        ))}
      </div>
      {count > 10 && <span className="tally-overflow" aria-hidden="true">+</span>}
      <span className="tally-count">{count}</span>
      <span className="tally-label">day{count === 1 ? '' : 's'}</span>
    </div>
  )
}

// ---------- heatmap strip ----------

function Heatmap({ completions }) {
  const today = todayStr()
  const scrollRef = useRef(null)
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

  useEffect(() => {
    const scroller = scrollRef.current
    if (scroller) scroller.scrollLeft = scroller.scrollWidth
  }, [])

  return (
    <div className="heatmap-scroll" ref={scrollRef}>
      <div className="heatmap" aria-label="Habit history">
        {cells.map((c) => {
          const statusLabel = c.filled ? 'completed' : c.skipped ? 'skipped' : 'not completed'
          const label = `${c.dateStr}: ${statusLabel}${c.isToday ? ' (today)' : ''}`
          return (
            <span
              key={c.dateStr}
              className={`cell ${c.filled ? 'filled' : ''} ${c.skipped ? 'skipped' : ''} ${c.isToday ? 'today' : ''}`}
              title={label}
              aria-label={label}
            />
          )
        })}
      </div>
    </div>
  )
}

function WeekOverview({ completions, onCycleDate }) {
  const today = todayStr()
  const week = currentWeekDates()

  return (
    <div className="week-overview" aria-label="This week">
      <div className="week-days">
        {week.map((dateStr, index) => {
          const status = completions[dateStr]
          const done = isDone(status)
          const skipped = isSkipped(status)
          const isToday = dateStr === today
          const weekday = new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })
          const statusText = done ? 'completed' : skipped ? 'skipped' : 'not completed'
          const label = `${weekday}, ${formatShortDate(dateStr)}: ${statusText}${
            isToday ? ' (today)' : ''
          }. Tap to cycle done, skipped, empty.`
          return (
            <button
              key={dateStr}
              type="button"
              className={`week-day week-day-expanded ${done ? 'done has-status' : ''} ${
                skipped ? 'skipped has-status' : ''
              } ${isToday ? 'today' : ''}`}
              onClick={() => onCycleDate(dateStr)}
              title={label}
              aria-label={label}
            >
              <span className="week-day-name">{weekday}</span>
              <span className="week-day-number">{dateStr.slice(-2)}</span>
              <span className="week-day-status" aria-hidden="true">{done ? '✓' : skipped ? '–' : ''}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------- habit row ----------

function HabitRow({
  habit,
  onDelete,
  onRename,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  isDragOver,
  onCycleDate,
}) {
  const today = todayStr()
  const streak = useMemo(() => currentStreak(habit.completions, today), [habit.completions, today])
  const best = useMemo(() => bestStreak(habit.completions), [habit.completions])

  const [isEditing, setIsEditing] = useState(false)
  const [draftName, setDraftName] = useState(habit.name)
  const [expanded, setExpanded] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const menuRef = useRef(null)
  const handleRef = useRef(null)
  const touchDraggingRef = useRef(false)
  const todayStatus = habit.completions[today]
  const todayDone = isDone(todayStatus)
  const todaySkipped = isSkipped(todayStatus)

  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
        setConfirmingDelete(false)
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setConfirmingDelete(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [menuOpen])

  // Touch-based drag-to-reorder. The native HTML5 drag-and-drop API used for
  // mouse dragging (draggable / onDragStart / onDragOver / onDrop) never
  // fires on touch devices, so dragging needs a separate touch implementation
  // that drives the same onDragStart/onDragOver/onDrop/onDragEnd callbacks.
  // Attached as real DOM listeners (not React's onTouch* props) so touchmove
  // can call preventDefault and stop the page from scrolling mid-drag —
  // React's synthetic touch handlers are passive and can't do that.
  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return

    function targetIdAt(x, y) {
      const el = document.elementFromPoint(x, y)
      const rowEl = el && el.closest ? el.closest('[data-habit-id]') : null
      return rowEl ? rowEl.getAttribute('data-habit-id') : null
    }

    function onTouchStart() {
      touchDraggingRef.current = true
      onDragStart(habit.id)
    }

    function onTouchMove(e) {
      if (!touchDraggingRef.current) return
      e.preventDefault()
      const touch = e.touches[0]
      const targetId = targetIdAt(touch.clientX, touch.clientY)
      if (targetId) onDragOver(targetId)
    }

    function onTouchEnd(e) {
      if (!touchDraggingRef.current) return
      touchDraggingRef.current = false
      const touch = e.changedTouches[0]
      const targetId = targetIdAt(touch.clientX, touch.clientY)
      if (targetId) {
        onDrop(targetId)
      } else {
        onDragEnd()
      }
    }

    handle.addEventListener('touchstart', onTouchStart, { passive: true })
    handle.addEventListener('touchmove', onTouchMove, { passive: false })
    handle.addEventListener('touchend', onTouchEnd, { passive: true })
    handle.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      handle.removeEventListener('touchstart', onTouchStart)
      handle.removeEventListener('touchmove', onTouchMove)
      handle.removeEventListener('touchend', onTouchEnd)
      handle.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [habit.id, onDragStart, onDragOver, onDrop, onDragEnd])

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
      className={`row ${expanded ? 'row-expanded' : 'row-collapsed'} ${isDragging ? 'row-dragging' : ''} ${isDragOver ? 'row-drag-over' : ''}`}
      data-habit-id={habit.id}
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
            ref={handleRef}
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
            <span className="best">PB {best}</span>
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
              <div className="row-menu" ref={menuRef}>
                <button
                  className={`more-btn ${menuOpen ? 'open' : ''}`}
                  onClick={() => {
                    setConfirmingDelete(false)
                    setMenuOpen((open) => !open)
                  }}
                  aria-label="More actions"
                  aria-haspopup="true"
                  aria-expanded={menuOpen}
                  title="More"
                >
                  ⋯
                </button>
                {menuOpen && (
                  <div className="row-menu-panel">
                    {confirmingDelete ? (
                      <div className="row-menu-confirm">
                        <span className="row-menu-confirm-text">Delete "{habit.name}"?</span>
                        <div className="row-menu-confirm-actions">
                          <button
                            className="row-menu-confirm-btn row-menu-confirm-btn-danger"
                            onClick={() => {
                              setMenuOpen(false)
                              setConfirmingDelete(false)
                              onDelete(habit.id)
                            }}
                          >
                            Delete
                          </button>
                          <button
                            className="row-menu-confirm-btn"
                            onClick={() => setConfirmingDelete(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          className="row-menu-item"
                          onClick={() => {
                            setMenuOpen(false)
                            startEditing()
                          }}
                        >
                          ✎ Rename
                        </button>
                        <button
                          className="row-menu-item row-menu-item-danger"
                          onClick={() => setConfirmingDelete(true)}
                        >
                          ✕ Delete
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                className={`expand-btn ${expanded ? 'open' : ''}`}
                onClick={() => {
                  setExpanded((open) => {
                    if (open) setShowHistory(false)
                    return !open
                  })
                }}
                aria-expanded={expanded}
                aria-label={expanded ? 'Collapse habit' : 'Expand habit to show the week'}
              >
                <span>week</span>
                <b aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`today-cell ${todayDone ? 'done' : ''} ${todaySkipped ? 'skipped' : ''}`}
                onClick={() => onCycleDate(habit.id, today)}
                role="checkbox"
                aria-checked={todayDone ? true : todaySkipped ? 'mixed' : false}
                aria-label={`Today: ${todayDone ? 'completed' : todaySkipped ? 'skipped' : 'not completed'}. Tap to cycle status.`}
              >
                <span>Today</span>
                <strong aria-hidden="true">{todayDone ? '✓' : todaySkipped ? '–' : ''}</strong>
              </button>
            </>
          )}
        </div>
      </div>
      {expanded && (
        <div className="row-details">
          <div className="row-details-heading">
            <span>Last 7 days</span>
            <button
              type="button"
              className={`history-btn ${showHistory ? 'open' : ''}`}
              onClick={() => setShowHistory((open) => !open)}
              aria-expanded={showHistory}
            >
              <span>history</span>
              <b aria-hidden="true" />
            </button>
          </div>
          <WeekOverview
            completions={habit.completions}
            onCycleDate={(dateStr) => onCycleDate(habit.id, dateStr)}
          />
          {showHistory && (
            <div className="history-panel">
              <div className="history-heading">
                <span>Last 10 weeks</span>
                <span className="history-legend"><i className="legend-done" /> done <i className="legend-skipped" /> skipped</span>
              </div>
              <Heatmap completions={habit.completions} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- add form ----------

function AddHabitForm({ onAdd }) {
  const [value, setValue] = useState('')
  const [isCompact, setIsCompact] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 480px)').matches
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 480px)')
    const handleChange = (e) => setIsCompact(e.matches)
    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  }, [])

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
        placeholder={isCompact ? 'Name a habit...' : 'Name a habit — read daily, stretch, no sugar...'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={60}
      />
      <button type="submit" disabled={!value.trim()}>
        Add habit
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
  const [habitsSource, setHabitsSource] = useState('guest') // 'guest' | 'account'
  const [importCandidates, setImportCandidates] = useState([])
  const [importing, setImporting] = useState(false)
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)

  function renderHabitRow(h) {
    return (
      <HabitRow
        key={h.id}
        habit={h}
        onCycleDate={cycleDate}
        onDelete={deleteHabit}
        onRename={renameHabit}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        isDragging={dragId === h.id}
        isDragOver={overId === h.id && dragId !== h.id}
      />
    )
  }

  // Guest-mode persistence. Gated on habitsSource (not session directly) so
  // this never fires with stale account data still sitting in `habits` —
  // habitsSource and habits are always flipped together, in the same batch,
  // whenever we switch data sources (see the effect below).
  useEffect(() => {
    if (habitsSource !== 'guest') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(habits))
    } catch {
      // storage unavailable — fail silently, app still works in-session
    }
  }, [habits, habitsSource])

  // Load the right data source whenever auth state changes.
  useEffect(() => {
    if (!configured) return

    if (session) {
      setHabitsSource('account')
      loadRemoteHabits(session.user.id)
    } else if (!authLoading) {
      // signed out (including right after sign-out) — fall back to whatever
      // is in this browser's local storage
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        setHabits(raw ? JSON.parse(raw) : [])
      } catch {
        setHabits([])
      }
      setHabitsSource('guest')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  async function loadRemoteHabits(userId) {
    setHabitsLoading(true)
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', userId)
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
    if (!session) return
    await Promise.all(
      orderedHabits.map((h, idx) =>
        supabase.from('habits').update({ position: idx }).eq('id', h.id).eq('user_id', session.user.id)
      )
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

  const [accent, setAccent] = useState(() => {
    try {
      const stored = localStorage.getItem(ACCENT_KEY)
      if (/^#[0-9a-f]{6}$/i.test(stored || '')) return stored
    } catch {
      // ignore
    }
    return theme === 'dark' ? '#e3a548' : '#96620e'
  })

  useEffect(() => {
    document.documentElement.style.setProperty('--amber', accent)
    try {
      localStorage.setItem(ACCENT_KEY, accent)
    } catch {
      // storage unavailable — accent still applies for this session
    }
  }, [accent])

  const [sage, setSage] = useState(() => {
    try {
      const stored = localStorage.getItem(SAGE_KEY)
      if (/^#[0-9a-f]{6}$/i.test(stored || '')) return stored
    } catch {
      // ignore
    }
    return theme === 'dark' ? '#74ae69' : '#4c7a48'
  })

  useEffect(() => {
    document.documentElement.style.setProperty('--sage', sage)
    try {
      localStorage.setItem(SAGE_KEY, sage)
    } catch {
      // storage unavailable — green still applies for this session
    }
  }, [sage])

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

  // Cycles a single day's status: empty -> done -> skipped -> empty. This is
  // what each day cell in the 7-day strip does now, replacing the separate
  // "mark today" / "skip" buttons with a direct tap on the day itself.
  async function cycleDate(id, dateStr) {
    const habit = habits.find((h) => h.id === id)
    if (!habit) return
    const completions = { ...habit.completions }
    const current = completions[dateStr]
    if (isDone(current)) {
      completions[dateStr] = 'skipped'
    } else if (isSkipped(current)) {
      delete completions[dateStr]
    } else {
      completions[dateStr] = true
    }
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, completions } : h)))
    if (session) {
      await supabase.from('habits').update({ completions }).eq('id', id).eq('user_id', session.user.id)
    }
  }

  async function deleteHabit(id) {
    setHabits((prev) => prev.filter((h) => h.id !== id))
    if (session) {
      await supabase.from('habits').delete().eq('id', id).eq('user_id', session.user.id)
    }
  }

  async function renameHabit(id, newName) {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, name: newName } : h)))
    if (session) {
      await supabase.from('habits').update({ name: newName }).eq('id', id).eq('user_id', session.user.id)
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

  const loggedToday = habits.filter((habit) => {
    const status = habit.completions[todayStr()]
    return isDone(status) || isSkipped(status)
  }).length
  const todayProgress = habits.length ? Math.round((loggedToday / habits.length) * 100) : 0

  // ---------- floating progress bar (sticks to top once scrolled past) ----------

  const progressSentinelRef = useRef(null)
  const [progressStuck, setProgressStuck] = useState(false)

  useEffect(() => {
    const sentinel = progressSentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => setProgressStuck(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [habitsLoading, habits.length])

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
            accent={accent}
            onAccentChange={setAccent}
            sage={sage}
            onSageChange={setSage}
            session={session}
            configured={configured}
            authLoading={authLoading}
            displayName={profile?.full_name || ''}
            onSaveName={updateDisplayName}
          />
        </div>
      </div>
      <p className="subhead">a running tally of what you show up for</p>

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

      {!habitsLoading && habits.length > 0 && (
        <>
          <div className="today-progress-sentinel" ref={progressSentinelRef} />
          <section
            className={`today-progress${progressStuck ? ' today-progress--stuck' : ''}`}
            aria-label={`Today: ${loggedToday} of ${habits.length} habits logged`}
          >
            <div className="today-progress-heading">
              <span>Today</span>
              <strong>
                {loggedToday} of {habits.length} logged
              </strong>
            </div>
            <div
              className="today-progress-track"
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax={habits.length}
              aria-valuenow={loggedToday}
            >
              <div className="today-progress-fill" style={{ width: `${todayProgress}%` }} />
            </div>
          </section>
        </>
      )}

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
          {habits.map(renderHabitRow)}
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
