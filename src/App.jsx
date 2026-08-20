import { useEffect, useMemo, useState } from 'react'

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

function currentStreak(completions, today) {
  let streak = 0
  let cursor = today
  // if today isn't marked yet, start counting from yesterday so an
  // unbroken streak doesn't visually reset to 0 before the day ends
  if (!completions[cursor]) {
    cursor = addDays(cursor, -1)
  }
  while (completions[cursor]) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

function bestStreak(completions) {
  const dates = Object.keys(completions).filter((d) => completions[d]).sort()
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

function Heatmap({ completions }) {
  const today = todayStr()
  const cells = []
  for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
    const dateStr = addDays(today, -i)
    cells.push({
      dateStr,
      filled: !!completions[dateStr],
      isToday: dateStr === today,
    })
  }
  return (
    <div className="heatmap">
      {cells.map((c) => (
        <div
          key={c.dateStr}
          className={`cell ${c.filled ? 'filled' : ''} ${c.isToday ? 'today' : ''}`}
          title={c.dateStr}
        />
      ))}
    </div>
  )
}

// ---------- habit row ----------

function HabitRow({ habit, onToggleToday, onDelete, onRename }) {
  const today = todayStr()
  const doneToday = !!habit.completions[today]
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
    <div className="row">
      <div className="row-top">
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
      <Heatmap completions={habit.completions} />
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
  const [habits, setHabits] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(habits))
    } catch {
      // storage unavailable — fail silently, app still works in-session
    }
  }, [habits])

  function addHabit(name) {
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

  function toggleToday(id) {
    const today = todayStr()
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h
        const completions = { ...h.completions }
        if (completions[today]) {
          delete completions[today]
        } else {
          completions[today] = true
        }
        return { ...h, completions }
      })
    )
  }

  function deleteHabit(id) {
    setHabits((prev) => prev.filter((h) => h.id !== id))
  }

  function renameHabit(id, newName) {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, name: newName } : h)))
  }

  return (
    <div className="app">
      <div className="header">
        <h1>Habit Ledger</h1>
        <div className="header-right">
          <span className="date">
            <span className="dot">●</span> {formatHeaderDate()}
          </span>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? '☾' : '☀'}
          </button>
        </div>
      </div>
      <p className="subhead">a running tally of what you show up for</p>

      <AddHabitForm onAdd={addHabit} />
      <hr className="rule" />

      {habits.length === 0 ? (
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
              onDelete={deleteHabit}
              onRename={renameHabit}
            />
          ))}
        </div>
      )}

      <div className="footer">
        entries saved to this browser only · {habits.length} habit{habits.length === 1 ? '' : 's'} tracked
      </div>
    </div>
  )
}
