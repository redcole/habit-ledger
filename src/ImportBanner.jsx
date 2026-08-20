export default function ImportBanner({ count, onImport, onDismiss, importing }) {
  return (
    <div className="import-banner">
      <span>
        Found {count} habit{count === 1 ? '' : 's'} saved on this browser from before you signed
        in. Add {count === 1 ? 'it' : 'them'} to your account?
      </span>
      <div className="import-actions">
        <button className="account-link-btn account-link-btn-accent" onClick={onImport} disabled={importing}>
          {importing ? 'adding...' : 'add to account'}
        </button>
        <button className="account-link-btn" onClick={onDismiss} disabled={importing}>
          dismiss
        </button>
      </div>
    </div>
  )
}
