import { useFocusTrap } from '../../lib/useFocusTrap';
import { SHORTCUTS } from '../hooks/usePlayerShortcuts';
import { CloseIcon } from './Icons';

/**
 * The keyboard map, on `?`.
 *
 * A player with twelve shortcuts and no way to see them has, in practice, the
 * three that people guessed. The list is generated from the same constant the
 * handler documents, so it cannot describe a binding that no longer exists.
 */
export default function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const panelRef = useFocusTrap(onClose);

  return (
    <div className="pv-settings-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Scorciatoie da tastiera"
        className="pv-settings-panel pv-shortcuts-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pv-settings-header">
          <h3 className="pv-shortcuts-title">Scorciatoie</h3>
          <button className="pv-icon-btn" aria-label="Chiudi" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <ul className="pv-shortcuts-list">
          {SHORTCUTS.map((s) => (
            <li key={`${s.keys}-${s.label}`}>
              <kbd className="pv-mono">{s.keys}</kbd>
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
