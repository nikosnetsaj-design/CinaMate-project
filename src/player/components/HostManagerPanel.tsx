import { useState } from 'react';
import type { FormEvent } from 'react';
import type { useHostMonitor } from '../hooks/useHostMonitor';
import type { StreamHost, MonitorIntervalMs, HostSwitchReason, HostStatus } from '../types';
import { getHostHistory } from '../services/hostStore';

type Props = {
  hostMonitor: ReturnType<typeof useHostMonitor>;
};

const INTERVAL_OPTIONS: { value: MonitorIntervalMs; label: string }[] = [
  { value: 60_000, label: 'Ogni 1 minuto' },
  { value: 300_000, label: 'Ogni 5 minuti' },
  { value: 600_000, label: 'Ogni 10 minuti' },
  { value: 1_800_000, label: 'Ogni 30 minuti' },
  { value: 3_600_000, label: 'Ogni 1 ora' },
];

const TIMEOUT_OPTIONS = [3000, 5000, 8000, 15000];

const ROLE_LABEL: Record<StreamHost['role'], string> = {
  primary: '⭐ Principale',
  secondary: '⭐ Secondario',
  backup: '⭐ Backup',
};

const STATUS_DOT: Record<HostStatus, string> = { online: '🟢', slow: '🟠', offline: '🔴', unknown: '⚪' };
const STATUS_LABEL: Record<HostStatus, string> = { online: 'Online', slow: 'Lento', offline: 'Offline', unknown: 'Sconosciuto' };
const REASON_LABEL: Record<HostSwitchReason, string> = {
  offline: 'host offline',
  high_ping: 'ping troppo alto',
  timeout: 'timeout',
  http_error: 'errore HTTP',
  manual: 'cambio manuale',
  recovered_to_primary: 'ritorno al principale',
};

function pingToStars(pingMs: number | null): number {
  if (pingMs === null) return 0;
  if (pingMs < 30) return 5;
  if (pingMs < 60) return 4;
  if (pingMs < 120) return 3;
  if (pingMs < 250) return 2;
  return 1;
}

// Visual-only scale for the ping bar fill — not a precision measurement,
// just a smooth, capped inverse mapping so lower ping reads as a longer bar.
function pingBarPercent(pingMs: number | null): number {
  if (pingMs === null) return 0;
  return Math.max(8, Math.min(100, 100 - (pingMs / 200) * 100));
}

function timeAgo(ts: number | null | undefined): string {
  if (!ts) return '—';
  const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (diffSec < 5) return 'adesso';
  if (diffSec < 60) return `${diffSec} secondi fa`;
  if (diffSec < 3600) return `${Math.round(diffSec / 60)} minuti fa`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)} ore fa`;
  return `${Math.round(diffSec / 86400)} giorni fa`;
}

function formatUptimeDuration(ms: number | null): string {
  if (ms === null) return '—';
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const minutes = totalMin % 60;
  if (days > 0) return `${days}g ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function HostManagerPanel({ hostMonitor }: Props) {
  const {
    hosts, results, stats, activeHostId, activeHost, switchLog,
    timeoutMs, setTimeoutMs, pingThresholdMs, setPingThresholdMs,
    monitorIntervalMs, setMonitorIntervalMs, isTesting,
    testHost, testAll, addHost, updateHost, removeHost, reorderHosts, switchManually,
  } = hostMonitor;

  const [dragId, setDragId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ name: string; url: string; role: StreamHost['role'] } | null>(null);
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newRole, setNewRole] = useState<StreamHost['role']>('secondary');

  const orderedHosts = [...hosts].sort((a, b) => a.priority - b.priority);
  const activeResult = activeHostId ? results[activeHostId] : null;
  const activeStats = activeHostId ? stats[activeHostId] : null;
  const activeStars = pingToStars(activeResult?.pingMs ?? null);

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const ids = orderedHosts.map(h => h.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    reorderHosts(ids);
    setDragId(null);
  };

  const startEdit = (host: StreamHost) => {
    setEditingId(host.id);
    setEditDraft({ name: host.name, url: host.url, role: host.role });
  };
  const saveEdit = (id: string) => {
    if (editDraft) updateHost(id, editDraft);
    setEditingId(null);
    setEditDraft(null);
  };

  const handleAddSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUrl.trim()) return;
    addHost({ name: newName.trim(), url: newUrl.trim(), role: newRole });
    setNewName('');
    setNewUrl('');
    setNewRole('secondary');
    setShowAddForm(false);
  };

  return (
    <div className="pv-panel pv-hostmanager">
      <div className="pv-panel-header">
        <h3>Gestione Host</h3>
      </div>

      {activeHost && (
        <div className="pv-host-active-card">
          <span className="pv-host-active-label">Host Attivo</span>
          <div className="pv-host-active-name">
            {STATUS_DOT[activeResult?.status ?? 'unknown']} {activeHost.name}
          </div>
          <div className="pv-host-active-metrics">
            <span>Ping: {activeResult?.pingMs ?? '—'} ms</span>
            <span>Uptime: {(activeStats?.uptimePercent ?? 0).toFixed(2)}%</span>
          </div>
          <div className="pv-host-active-metrics">
            <span>Tempo online: {formatUptimeDuration(activeStats?.currentUptimeMs ?? null)}</span>
            <span>Ultimo controllo: {timeAgo(activeResult?.checkedAt)}</span>
          </div>
          <div className="pv-host-stars" aria-label={`Velocità: ${activeStars} su 5`}>
            {'★'.repeat(activeStars)}
            <span className="pv-host-stars-dim">{'★'.repeat(5 - activeStars)}</span>
          </div>
          <div className={`pv-host-status-chip pv-host-status-chip--${activeResult?.status ?? 'unknown'}`}>
            {STATUS_DOT[activeResult?.status ?? 'unknown']} {STATUS_LABEL[activeResult?.status ?? 'unknown']}
          </div>
        </div>
      )}

      <div className="pv-host-toolbar">
        <button onClick={() => testAll(true)} disabled={isTesting}>
          {isTesting ? 'Test in corso…' : 'Testa tutti (parallelo)'}
        </button>
        <button onClick={() => testAll(false)} disabled={isTesting}>Testa in sequenza</button>
        <label className="pv-host-setting">
          Timeout
          <select value={timeoutMs} onChange={e => setTimeoutMs(Number(e.target.value))}>
            {TIMEOUT_OPTIONS.map(t => <option key={t} value={t}>{t / 1000}s</option>)}
          </select>
        </label>
        <label className="pv-host-setting">
          Controllo
          <select value={monitorIntervalMs} onChange={e => setMonitorIntervalMs(Number(e.target.value) as MonitorIntervalMs)}>
            {INTERVAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="pv-host-setting">
          Soglia ping lento
          <select value={pingThresholdMs} onChange={e => setPingThresholdMs(Number(e.target.value))}>
            <option value={150}>150 ms</option>
            <option value={300}>300 ms</option>
            <option value={500}>500 ms</option>
            <option value={1000}>1000 ms</option>
          </select>
        </label>
      </div>

      <div className="pv-host-list">
        {orderedHosts.length === 0 && (
          <p className="pv-empty">
            Nessun host configurato. Un host che aggiungi qui è anche un indirizzo dove cercare i
            titoli: come le caselle in Impostazioni, viene provato quando premi Guarda, e vale anche
            il solo indirizzo del server. In più, se lo stesso contenuto è servito da più origini
            identiche (lo stesso percorso su ogni mirror), la riproduzione passa all'host successivo
            quando il primo non risponde.
          </p>
        )}
        {orderedHosts.map(host => {
          const result = results[host.id];
          const hostStats = stats[host.id];
          const isActive = activeHostId === host.id;
          const isEditing = editingId === host.id;
          const historyOpen = historyOpenId === host.id;

          return (
            <div
              key={host.id}
              className={`pv-host-row ${isActive ? 'pv-host-row--active' : ''} ${dragId === host.id ? 'pv-host-row--dragging' : ''}`}
              draggable={!isEditing}
              onDragStart={() => setDragId(host.id)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(host.id)}
              onDragEnd={() => setDragId(null)}
            >
              <div className="pv-host-drag-handle" title="Trascina per riordinare la priorità" aria-hidden>⠿⠿</div>

              <div className="pv-host-row-main">
                {isEditing && editDraft ? (
                  <div className="pv-host-edit-form">
                    <input value={editDraft.name} onChange={e => setEditDraft({ ...editDraft, name: e.target.value })} placeholder="Nome host" />
                    <input value={editDraft.url} onChange={e => setEditDraft({ ...editDraft, url: e.target.value })} placeholder="https://..." />
                    <select value={editDraft.role} onChange={e => setEditDraft({ ...editDraft, role: e.target.value as StreamHost['role'] })}>
                      <option value="primary">Principale</option>
                      <option value="secondary">Secondario</option>
                      <option value="backup">Backup</option>
                    </select>
                    <div className="pv-host-edit-actions">
                      <button onClick={() => saveEdit(host.id)}>Salva</button>
                      <button className="pv-btn-secondary" onClick={() => setEditingId(null)}>Annulla</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="pv-host-row-title">
                      <span>{STATUS_DOT[result?.status ?? 'unknown']}</span>
                      <span className="pv-host-row-name">{host.name}</span>
                      <span className="pv-host-role-badge">{ROLE_LABEL[host.role]}</span>
                      {isActive && <span className="pv-badge pv-badge-active">Attivo</span>}
                    </div>

                    <div className="pv-host-ping-bar">
                      <div className={`pv-host-ping-fill pv-host-ping-fill--${result?.status ?? 'unknown'}`} style={{ width: `${pingBarPercent(result?.pingMs ?? null)}%` }} />
                      <span className="pv-host-ping-label">{result?.pingMs ?? '—'} ms</span>
                    </div>

                    <div className="pv-host-row-meta">
                      <span>Risposta: {result?.responseTimeMs ?? '—'} ms</span>
                      <span>Ultimo controllo: {timeAgo(result?.checkedAt)}</span>
                      <span>Tempo online: {formatUptimeDuration(hostStats?.currentUptimeMs ?? null)}</span>
                      <span>SSL: {result?.sslOk === true ? 'valido' : result?.sslOk === false ? 'non verificabile' : '—'}</span>
                      <span>API: {result?.apiVersion ?? '—'}</span>
                      <span>Affidabilità 30gg: {hostStats ? `${hostStats.reliability30d}%` : '—'}</span>
                    </div>
                    <div className="pv-host-row-url">{host.url}</div>

                    {historyOpen && (
                      <div className="pv-host-test-history">
                        {getHostHistory(host.id, 5).map((r, i) => (
                          <div key={i} className="pv-host-test-history-row">
                            <span>{STATUS_DOT[r.status]}</span>
                            <span>{timeAgo(r.checkedAt)}</span>
                            <span>{r.pingMs ?? '—'} ms</span>
                          </div>
                        ))}
                        {getHostHistory(host.id, 5).length === 0 && <span className="pv-empty">Nessun test ancora.</span>}
                      </div>
                    )}
                  </>
                )}
              </div>

              {!isEditing && (
                <div className="pv-host-row-actions">
                  <button className="pv-btn-tiny" onClick={() => testHost(host.id)} disabled={isTesting}>Test</button>
                  {!isActive && <button className="pv-btn-tiny" onClick={() => switchManually(host.id)}>Usa</button>}
                  <button className="pv-btn-tiny" onClick={() => setHistoryOpenId(historyOpen ? null : host.id)}>Cronologia</button>
                  <button className="pv-btn-tiny" onClick={() => startEdit(host)}>Modifica</button>
                  <button className="pv-btn-tiny pv-host-remove" onClick={() => removeHost(host.id)}>Rimuovi</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showAddForm ? (
        <form className="pv-host-add-form" onSubmit={handleAddSubmit}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome host" required />
          <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://cdn.esempio.com" required />
          <select value={newRole} onChange={e => setNewRole(e.target.value as StreamHost['role'])}>
            <option value="primary">Principale</option>
            <option value="secondary">Secondario</option>
            <option value="backup">Backup</option>
          </select>
          <div className="pv-host-edit-actions">
            <button type="submit">Aggiungi</button>
            <button type="button" className="pv-btn-secondary" onClick={() => setShowAddForm(false)}>Annulla</button>
          </div>
        </form>
      ) : (
        <button className="pv-host-add-toggle" onClick={() => setShowAddForm(true)}>+ Aggiungi host</button>
      )}

      <div className="pv-host-history-log">
        <h4>Cronologia cambi host</h4>
        {switchLog.length === 0 && <p className="pv-empty">Nessun cambio host registrato.</p>}
        {switchLog.map(ev => (
          <div key={ev.id} className="pv-host-history-row">
            <span>{new Date(ev.at).toLocaleString('it-IT')}</span>
            <span>
              {hosts.find(h => h.id === ev.fromHostId)?.name ?? '—'} → {hosts.find(h => h.id === ev.toHostId)?.name ?? ev.toHostId}
            </span>
            <span className="pv-host-history-reason">{REASON_LABEL[ev.reason]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
