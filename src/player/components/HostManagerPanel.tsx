import { useState } from 'react';
import type { FormEvent } from 'react';
import type { useHostMonitor } from '../hooks/useHostMonitor';
import type {
  StreamHost,
  MonitorIntervalMs,
  HostSwitchReason,
  HostStatus,
  HostSelectionMode,
  HostSpeedSample,
} from '../types';
import { getHostHistory } from '../services/hostStore';
import { StarIcon } from '../../components/icons';
import { t } from "../../lib/i18n";

type Props = {
  hostMonitor: ReturnType<typeof useHostMonitor>;
};

const INTERVAL_OPTIONS: { value: MonitorIntervalMs; label: string }[] = [
  { value: 60_000, label: t("player_HostManagerPanel.ogni_1_minuto") },
  { value: 300_000, label: t("player_HostManagerPanel.ogni_5_minuti") },
  { value: 600_000, label: t("player_HostManagerPanel.ogni_10_minuti") },
  { value: 1_800_000, label: t("player_HostManagerPanel.ogni_30_minuti") },
  { value: 3_600_000, label: t("player_HostManagerPanel.ogni_1_ora") },
];

const TIMEOUT_OPTIONS = [3000, 5000, 8000, 15000];

const ROLE_LABEL: Record<StreamHost['role'], string> = {
  primary: t("player_HostManagerPanel.principale"),
  secondary: t("player_HostManagerPanel.secondario"),
  backup: 'Backup',
};

/* Lo stato di un host in un punto colorato, non in un'emoji: le emoji tonde
   cambiano colore e misura da un telefono all'altro, e «sconosciuto» era un
   cerchio bianco che sul fondo scuro sembrava una luce accesa. */
function StatusDot({ status }: { status: HostStatus }) {
  return <span className={`pv-dot pv-dot--${status}`} aria-hidden="true" />;
}
const STATUS_LABEL: Record<HostStatus, string> = { online: 'Online', slow: t("player_HostManagerPanel.lento"), offline: 'Offline', unknown: t("player_HostManagerPanel.sconosciuto") };
const REASON_LABEL: Record<HostSwitchReason, string> = {
  offline: 'host offline',
  high_ping: t("player_HostManagerPanel.ping_troppo_alto"),
  timeout: 'timeout',
  http_error: t("player_HostManagerPanel.errore_http"),
  manual: t("player_HostManagerPanel.cambio_manuale"),
  recovered_to_primary: t("player_HostManagerPanel.ritorno_al_principale"),
  auto_ranked: t("player_HostManagerPanel.priorita_automatica"),
  load_balanced: t("player_HostManagerPanel.bilanciamento_del_carico"),
};

const MODE_OPTIONS: { value: HostSelectionMode; label: string; hint: string }[] = [
  {
    value: 'priority',
    label: t("player_HostManagerPanel.priorita_manuale"),
    hint: t("player_HostManagerPanel.usa_il_primo_host"),
  },
  {
    value: 'auto',
    label: t("player_HostManagerPanel.priorita_automatica_2"),
    hint: t("player_HostManagerPanel.sceglie_da_se_l"),
  },
  {
    value: 'balanced',
    label: t("player_HostManagerPanel.bilanciamento_del_carico_2"),
    hint: t("player_HostManagerPanel.distribuisce_le_sessioni_fra"),
  },
];

const SPEED_NOTE: Record<NonNullable<HostSpeedSample['note']>, string> = {
  sample_too_small: t("player_HostManagerPanel.campione_troppo_piccolo_per"),
  unreachable: t("player_HostManagerPanel.host_non_raggiungibile"),
  no_body: t("player_HostManagerPanel.risposta_senza_corpo_da"),
};

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** What a measured throughput is actually good for, in the units people watch in. */
function speedVerdict(mbps: number): string {
  if (mbps >= 25) return '4K';
  if (mbps >= 8) return '1080p';
  if (mbps >= 5) return '720p';
  if (mbps >= 2) return '480p';
  return t("player_HostManagerPanel.sotto_i_480p");
}

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
  if (diffSec < 60) return t("player_HostManagerPanel.secondi_fa", { v0: diffSec });
  if (diffSec < 3600) return t("player_HostManagerPanel.minuti_fa", { v0: Math.round(diffSec / 60) });
  if (diffSec < 86400) return t("player_HostManagerPanel.ore_fa", { v0: Math.round(diffSec / 3600) });
  return t("player_HostManagerPanel.giorni_fa", { v0: Math.round(diffSec / 86400) });
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
    hosts, rankedHosts, results, stats, speedSamples, activeHostId, activeHost, switchLog,
    timeoutMs, setTimeoutMs, pingThresholdMs, setPingThresholdMs,
    monitorIntervalMs, setMonitorIntervalMs, isTesting, speedTestingId,
    selectionMode, setSelectionMode, runSpeedTest, runAllSpeedTests,
    testHost, testAll, addHost, updateHost, removeHost, reorderHosts, switchManually,
  } = hostMonitor;

  const [dragId, setDragId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<
    { name: string; url: string; role: StreamHost['role']; speedTestPath: string } | null
  >(null);
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newRole, setNewRole] = useState<StreamHost['role']>('secondary');
  const [newSpeedPath, setNewSpeedPath] = useState('');

  // In automatic mode the list is shown in the order that mode actually uses,
  // so the panel never displays a ranking the player is ignoring.
  const orderedHosts =
    selectionMode === 'auto' ? rankedHosts : [...hosts].sort((a, b) => a.priority - b.priority);
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
    setEditDraft({ name: host.name, url: host.url, role: host.role, speedTestPath: host.speedTestPath ?? '' });
  };
  const saveEdit = (id: string) => {
    if (editDraft) {
      const { speedTestPath, ...rest } = editDraft;
      updateHost(id, { ...rest, speedTestPath: speedTestPath.trim() || undefined });
    }
    setEditingId(null);
    setEditDraft(null);
  };

  const handleAddSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUrl.trim()) return;
    addHost({
      name: newName.trim(),
      url: newUrl.trim(),
      role: newRole,
      speedTestPath: newSpeedPath.trim() || undefined,
    });
    setNewName('');
    setNewUrl('');
    setNewRole('secondary');
    setNewSpeedPath('');
    setShowAddForm(false);
  };

  return (
    <div className="pv-panel pv-hostmanager">
      <div className="pv-panel-header">
        <h3>{t("player_HostManagerPanel.gestione_host")}</h3>
      </div>

      {activeHost && (
        <div className="pv-host-active-card">
          <span className="pv-host-active-label">{t("player_HostManagerPanel.host_attivo")}</span>
          <div className="pv-host-active-name">
            <StatusDot status={activeResult?.status ?? "unknown"} /> {activeHost.name}
          </div>
          <div className="pv-host-active-metrics">
            <span>{t("player_HostManagerPanel.ping")} {activeResult?.pingMs ?? '—'} {t("player_HostManagerPanel.ms")}</span>
            <span>{t("player_HostManagerPanel.uptime")} {(activeStats?.uptimePercent ?? 0).toFixed(2)}%</span>
          </div>
          <div className="pv-host-active-metrics">
            <span>{t("player_HostManagerPanel.tempo_online")} {formatUptimeDuration(activeStats?.currentUptimeMs ?? null)}</span>
            <span>{t("player_HostManagerPanel.ultimo_controllo")} {timeAgo(activeResult?.checkedAt)}</span>
          </div>
          <div className="pv-host-active-metrics">
            <span>
              {t("player_HostManagerPanel.velocita")}{' '}
              {activeStats?.avgSpeedMbps != null
                ? t("player_HostManagerPanel.mbps", { v0: activeStats.avgSpeedMbps.toFixed(1) })
                : t("player_HostManagerPanel.non_misurata")}
            </span>
            <span>{t("player_HostManagerPanel.punteggio")} {activeStats ? `${activeStats.score}/100` : '—'}</span>
          </div>
          <div className="pv-host-stars" aria-label={t("player_HostManagerPanel.velocita_su_5", { v0: activeStars })}>
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className={i < activeStars ? undefined : 'pv-host-stars-dim'}>
                <StarIcon size={12} filled />
              </span>
            ))}
          </div>
          <div className={`pv-host-status-chip pv-host-status-chip--${activeResult?.status ?? "unknown"}`}>
            <StatusDot status={activeResult?.status ?? "unknown"} /> {STATUS_LABEL[activeResult?.status ?? "unknown"]}
          </div>
        </div>
      )}

      <div className="pv-host-modes" role="group" aria-label={t("player_HostManagerPanel.come_scegliere_l_host")}>
        {MODE_OPTIONS.map(mode => (
          <button
            key={mode.value}
            type="button"
            aria-pressed={selectionMode === mode.value}
            className={`pv-host-mode ${selectionMode === mode.value ? "active" : ''}`}
            onClick={() => setSelectionMode(mode.value)}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <p className="pv-empty pv-host-mode-hint">
        {MODE_OPTIONS.find(m => m.value === selectionMode)?.hint}
      </p>

      <div className="pv-host-toolbar">
        <button onClick={() => testAll(true)} disabled={isTesting}>
          {isTesting ? t("player_HostManagerPanel.test_in_corso") : t("player_HostManagerPanel.testa_tutti_parallelo")}
        </button>
        <button onClick={() => testAll(false)} disabled={isTesting}>{t("player_HostManagerPanel.testa_in_sequenza")}</button>
        <button onClick={runAllSpeedTests} disabled={speedTestingId !== null || hosts.length === 0}>
          {speedTestingId === '*' ? t("player_HostManagerPanel.misuro_la_velocita") : t("player_HostManagerPanel.test_velocita")}
        </button>
        <label className="pv-host-setting">
          {t("player_HostManagerPanel.timeout")}
          <select value={timeoutMs} onChange={e => setTimeoutMs(Number(e.target.value))}>
            {TIMEOUT_OPTIONS.map(t => <option key={t} value={t}>{t / 1000}s</option>)}
          </select>
        </label>
        <label className="pv-host-setting">
          {t("player_HostManagerPanel.controllo")}
          <select value={monitorIntervalMs} onChange={e => setMonitorIntervalMs(Number(e.target.value) as MonitorIntervalMs)}>
            {INTERVAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="pv-host-setting">
          {t("player_HostManagerPanel.soglia_ping_lento")}
          <select value={pingThresholdMs} onChange={e => setPingThresholdMs(Number(e.target.value))}>
            <option value={150}>{t("player_HostManagerPanel.150_ms")}</option>
            <option value={300}>{t("player_HostManagerPanel.300_ms")}</option>
            <option value={500}>{t("player_HostManagerPanel.500_ms")}</option>
            <option value={1000}>{t("player_HostManagerPanel.1000_ms")}</option>
          </select>
        </label>
      </div>

      <div className="pv-host-list">
        {orderedHosts.length === 0 && (
          <p className="pv-empty">
            {t("player_HostManagerPanel.nessun_host_configurato_un")}
          </p>
        )}
        {orderedHosts.map(host => {
          const result = results[host.id];
          const hostStats = stats[host.id];
          const speedSample = speedSamples[host.id];
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
              <div className="pv-host-drag-handle" title={t("player_HostManagerPanel.trascina_per_riordinare_la")} aria-hidden>⠿⠿</div>

              <div className="pv-host-row-main">
                {isEditing && editDraft ? (
                  <div className="pv-host-edit-form">
                    <input value={editDraft.name} onChange={e => setEditDraft({ ...editDraft, name: e.target.value })} placeholder={t("player_HostManagerPanel.nome_host")} />
                    <input value={editDraft.url} onChange={e => setEditDraft({ ...editDraft, url: e.target.value })} placeholder="https://..." />
                    <select value={editDraft.role} onChange={e => setEditDraft({ ...editDraft, role: e.target.value as StreamHost['role'] })}>
                      <option value="primary">{t("player_HostManagerPanel.principale")}</option>
                      <option value="secondary">{t("player_HostManagerPanel.secondario")}</option>
                      <option value="backup">{t("player_HostManagerPanel.backup")}</option>
                    </select>
                    <input
                      value={editDraft.speedTestPath}
                      onChange={e => setEditDraft({ ...editDraft, speedTestPath: e.target.value })}
                      placeholder={t("player_HostManagerPanel.percorso_per_il_test")}
                      aria-label={t("player_HostManagerPanel.percorso_per_il_test_2")}
                    />
                    <div className="pv-host-edit-actions">
                      <button onClick={() => saveEdit(host.id)}>{t("player_HostManagerPanel.salva")}</button>
                      <button className="pv-btn-secondary" onClick={() => setEditingId(null)}>{t("player_HostManagerPanel.annulla")}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="pv-host-row-title">
                      <StatusDot status={result?.status ?? "unknown"} />
                      <span className="pv-host-row-name">{host.name}</span>
                      <span className="pv-host-role-badge">{ROLE_LABEL[host.role]}</span>
                      {isActive && <span className="pv-badge pv-badge-active">{t("player_HostManagerPanel.attivo")}</span>}
                    </div>

                    <div className="pv-host-ping-bar">
                      <div className={`pv-host-ping-fill pv-host-ping-fill--${result?.status ?? "unknown"}`} style={{ width: `${pingBarPercent(result?.pingMs ?? null)}%` }} />
                      <span className="pv-host-ping-label">{result?.pingMs ?? '—'} {t("player_HostManagerPanel.ms")}</span>
                    </div>

                    <div className="pv-host-row-meta">
                      <span>{t("player_HostManagerPanel.risposta")} {result?.responseTimeMs ?? '—'} {t("player_HostManagerPanel.ms")}</span>
                      <span>{t("player_HostManagerPanel.ultimo_controllo")} {timeAgo(result?.checkedAt)}</span>
                      <span>{t("player_HostManagerPanel.tempo_online")} {formatUptimeDuration(hostStats?.currentUptimeMs ?? null)}</span>
                      <span>{t("player_HostManagerPanel.ssl")} {result?.sslOk === true ? t("player_HostManagerPanel.valido") : result?.sslOk === false ? t("player_HostManagerPanel.non_verificabile") : '—'}</span>
                      <span>{t("player_HostManagerPanel.api")} {result?.apiVersion ?? '—'}</span>
                      <span>{t("player_HostManagerPanel.affidabilita_30gg")} {hostStats ? `${hostStats.reliability30d}%` : '—'}</span>
                      <span>{t("player_HostManagerPanel.punteggio")} {hostStats ? `${hostStats.score}/100` : '—'}</span>
                      <span>
                        {t("player_HostManagerPanel.velocita")}{' '}
                        {hostStats?.avgSpeedMbps != null
                          ? t("player_HostManagerPanel.mbps_2", { v0: hostStats.avgSpeedMbps.toFixed(1), v1: speedVerdict(hostStats.avgSpeedMbps) })
                          : t("player_HostManagerPanel.non_misurata")}
                      </span>
                    </div>
                    <div className="pv-host-row-url">{host.url}</div>

                    {/* A speed test that couldn't measure anything says why, and
                        what to do about it: the fix is a path with a real file
                        behind it, which only whoever runs the server can supply. */}
                    {speedSample && speedSample.mbps === null && speedSample.note && (
                      <p className="pv-host-speed-note">
                        {t("player_HostManagerPanel.test_velocita_2")} {SPEED_NOTE[speedSample.note]}
                        {speedSample.note === 'sample_too_small' && (
                          <>
                            {' '}({formatBytes(speedSample.sampleBytes)} {t("player_HostManagerPanel.scaricati_indica_in_modifica")}{' '}
                            <span className="pv-mono">{t("player_HostManagerPanel.ts")}</span> {t("player_HostManagerPanel.va_benissimo")}
                          </>
                        )}
                      </p>
                    )}

                    {historyOpen && (
                      <div className="pv-host-test-history">
                        {getHostHistory(host.id, 5).map((r, i) => (
                          <div key={i} className="pv-host-test-history-row">
                            <StatusDot status={r.status} />
                            <span>{timeAgo(r.checkedAt)}</span>
                            <span>{r.pingMs ?? '—'} {t("player_HostManagerPanel.ms")}</span>
                          </div>
                        ))}
                        {getHostHistory(host.id, 5).length === 0 && <span className="pv-empty">{t("player_HostManagerPanel.nessun_test_ancora")}</span>}
                      </div>
                    )}
                  </>
                )}
              </div>

              {!isEditing && (
                <div className="pv-host-row-actions">
                  <button className="pv-btn-tiny" onClick={() => testHost(host.id)} disabled={isTesting}>{t("player_HostManagerPanel.test")}</button>
                  <button
                    className="pv-btn-tiny"
                    onClick={() => runSpeedTest(host.id)}
                    disabled={speedTestingId !== null}
                  >
                    {speedTestingId === host.id ? t("player_HostManagerPanel.misuro") : t("player_HostManagerPanel.velocita_2")}
                  </button>
                  {!isActive && <button className="pv-btn-tiny" onClick={() => switchManually(host.id)}>{t("player_HostManagerPanel.usa")}</button>}
                  <button className="pv-btn-tiny" onClick={() => setHistoryOpenId(historyOpen ? null : host.id)}>{t("player_HostManagerPanel.cronologia")}</button>
                  <button className="pv-btn-tiny" onClick={() => startEdit(host)}>{t("player_HostManagerPanel.modifica")}</button>
                  <button className="pv-btn-tiny pv-host-remove" onClick={() => removeHost(host.id)}>{t("player_HostManagerPanel.rimuovi")}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showAddForm ? (
        <form className="pv-host-add-form" onSubmit={handleAddSubmit}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t("player_HostManagerPanel.nome_host")} required />
          <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://cdn.esempio.com" required />
          <select value={newRole} onChange={e => setNewRole(e.target.value as StreamHost['role'])}>
            <option value="primary">{t("player_HostManagerPanel.principale")}</option>
            <option value="secondary">{t("player_HostManagerPanel.secondario")}</option>
            <option value="backup">{t("player_HostManagerPanel.backup")}</option>
          </select>
          <input
            value={newSpeedPath}
            onChange={e => setNewSpeedPath(e.target.value)}
            placeholder={t("player_HostManagerPanel.percorso_per_il_test")}
            aria-label={t("player_HostManagerPanel.percorso_per_il_test_2")}
          />
          <p className="pv-empty">
            {t("player_HostManagerPanel.il_test_velocita_scarica")}
          </p>
          <div className="pv-host-edit-actions">
            <button type="submit">{t("player_HostManagerPanel.aggiungi")}</button>
            <button type="button" className="pv-btn-secondary" onClick={() => setShowAddForm(false)}>{t("player_HostManagerPanel.annulla")}</button>
          </div>
        </form>
      ) : (
        <button className="pv-host-add-toggle" onClick={() => setShowAddForm(true)}>{t("player_HostManagerPanel.aggiungi_host")}</button>
      )}

      <div className="pv-host-history-log">
        <h4>{t("player_HostManagerPanel.cronologia_cambi_host")}</h4>
        {switchLog.length === 0 && <p className="pv-empty">{t("player_HostManagerPanel.nessun_cambio_host_registrato")}</p>}
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
