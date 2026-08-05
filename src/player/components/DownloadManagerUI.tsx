import { useState, useEffect } from 'react';
import { useDownloadManager } from '../hooks/useDownloadManager';
import { getWatchStatus, getWatchUpdatedAt } from '../services/statsAndHistory';
import { canExportToDirectory, exportDownloadToDirectory } from '../services/downloadService';
import type { MediaContent, DownloadQuality } from '../types';

const QUALITIES: { id: DownloadQuality; label: string }[] = [
  { id: 'sd', label: 'SD' }, { id: 'hd', label: 'HD' }, { id: 'fullhd', label: 'Full HD' }, { id: '4k', label: '4K' },
];

const STATUS_LABELS: Record<string, string> = {
  queued: 'In coda', downloading: 'In corso', paused: 'In pausa', completed: 'Completato', error: 'Errore',
};

type Props = {
  library: MediaContent[];
  /** Play a completed download from local storage instead of over the network. */
  onPlayOffline?: (contentId: string, downloadId: string) => void;
  offlineContentId?: string | null;
};

export default function DownloadManagerUI({ library, onPlayOffline, offlineContentId }: Props) {
  const { downloads, storage, error, download, downloadSeason, pause, resume, remove } = useDownloadManager();
  const [autoDelete, setAutoDelete] = useState(false);
  const [pickerFor, setPickerFor] = useState<MediaContent | null>(null);
  // Esportazione su cartella: una alla volta, con il conto dei file scritti.
  // Su un film sono migliaia, e senza un numero che sale sembra bloccato.
  const [exporting, setExporting] = useState<{ id: string; done: number; total: number } | null>(null);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const canExport = canExportToDirectory();

  async function saveToFolder(id: string, title: string) {
    setExportNote(null);
    setExporting({ id, done: 0, total: 0 });
    try {
      const res = await exportDownloadToDirectory(id, title, (done, total) => setExporting({ id, done, total }));
      setExportNote(`Salvato in "${res.folder}": ${res.segments} file più playlist.m3u8. Apri la playlist con VLC.`);
    } catch (e) {
      // Annullare la scelta della cartella non è un errore da mostrare in rosso:
      // è una persona che ha cambiato idea.
      const aborted = e instanceof DOMException && e.name === 'AbortError';
      if (!aborted) setExportNote(e instanceof Error ? e.message : 'Non sono riuscito a salvare.');
    } finally {
      setExporting(null);
    }
  }

  const usedPct = storage.quota ? (storage.usage / storage.quota) * 100 : 0;

  // Frees space for a download once you've actually finished watching it.
  //
  // Off by default, and gated on *when* the title was finished: watching is
  // recorded per title, not per download, so "status is completed" alone also
  // matches a film you finished last year and have only just downloaded — which
  // the previous version deleted the instant the download landed. Only a
  // viewing that ended after the download was created counts.
  useEffect(() => {
    if (!autoDelete) return;
    downloads.forEach(d => {
      if (d.status !== 'completed') return;
      if (getWatchStatus(d.contentId) !== 'completed') return;
      const finishedAt = getWatchUpdatedAt(d.contentId);
      if (finishedAt !== null && finishedAt > d.createdAt) remove(d.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDelete, downloads]);

  return (
    <div className="pv-panel pv-downloads">
      <div className="pv-panel-header">
        <h3>Download</h3>
        <label className="pv-toggle">
          <input type="checkbox" checked={autoDelete} onChange={e => setAutoDelete(e.target.checked)} />
          Elimina automaticamente dopo la visione
        </label>
      </div>

      <div className="pv-storage-bar">
        <div className="pv-storage-fill" style={{ width: `${usedPct}%` }} />
        <span className="pv-mono">{formatBytes(storage.usage)} / {formatBytes(storage.quota)}</span>
      </div>

      {error && <p className="pv-download-error" role="alert">{error}</p>}

      <div className="pv-download-catalog">
        {library.map(item => (
          <div key={item.id} className="pv-download-row">
            {item.posterUrl && <img src={item.posterUrl} alt="" />}
            <span>{item.title}</span>
            <button className="pv-btn-secondary" onClick={() => setPickerFor(item)}>Scarica</button>
          </div>
        ))}
        {library.length > 1 && (
          // In CineMate `library` is every title that has a source, not a
          // season, so the label says what the button actually does.
          <button className="pv-btn-secondary" onClick={() => downloadSeason(library, 'hd')}>
            Scarica tutti i {library.length} titoli (HD)
          </button>
        )}
      </div>

      {pickerFor && (
        <div className="pv-modal-backdrop" onClick={() => setPickerFor(null)}>
          <div className="pv-modal" onClick={e => e.stopPropagation()}>
            <h4>Qualità per "{pickerFor.title}"</h4>
            <div className="pv-field-options">
              {QUALITIES.map(q => (
                <button key={q.id} onClick={() => { download(pickerFor, q.id); setPickerFor(null); }}>
                  {q.label}
                </button>
              ))}
            </div>
            <button className="pv-btn-secondary" onClick={() => setPickerFor(null)}>Annulla</button>
          </div>
        </div>
      )}

      <ul className="pv-download-list">
        {downloads.map(d => (
          <li key={d.id}>
            {d.posterUrl && <img src={d.posterUrl} alt="" />}
            <div className="pv-download-info">
              <span>{d.title} <span className="pv-dim">· {d.quality.toUpperCase()}</span></span>
              <div className="pv-progress-track pv-progress-track--thin">
                <div
                  className="pv-progress-played"
                  style={{ width: `${d.totalBytes ? (d.downloadedBytes / d.totalBytes) * 100 : 0}%` }}
                />
              </div>
              <span className="pv-download-status pv-dim">{STATUS_LABELS[d.status] ?? d.status}</span>
            </div>
            {d.status === 'completed' && onPlayOffline && (
              <button
                className={`pv-btn-tiny ${offlineContentId === d.contentId ? 'active' : ''}`}
                onClick={() => onPlayOffline(d.contentId, d.id)}
              >
                {offlineContentId === d.contentId ? 'In riproduzione' : 'Guarda offline'}
              </button>
            )}
            {d.status === 'downloading' && <button className="pv-btn-tiny" onClick={() => pause(d.id)}>Pausa</button>}
            {d.status === 'paused' && (
              <button
                className="pv-btn-tiny"
                onClick={() => {
                  const source = library.find(l => l.id === d.contentId);
                  if (source) resume(source, d.quality);
                }}
              >
                Riprendi
              </button>
            )}
            {d.status === 'completed' && canExport && (
              <button
                className="pv-btn-tiny"
                disabled={exporting !== null}
                onClick={() => saveToFolder(d.id, d.title)}
                title="Scrive una copia in una cartella scelta da te, oltre a quella che resta nell'app"
              >
                {exporting?.id === d.id
                  ? `Salvo… ${exporting.done}${exporting.total ? `/${exporting.total}` : ''}`
                  : 'Salva in una cartella'}
              </button>
            )}
            <button className="pv-btn-tiny" onClick={() => remove(d.id)}>Elimina</button>
          </li>
        ))}
        {downloads.length === 0 && <li className="pv-dim">Nessun download in corso.</li>}
      </ul>
      {exportNote && <p className="pv-dim">{exportNote}</p>}
      {downloads.some((d) => d.status === 'completed') && !canExport && (
        <p className="pv-dim">
          Salvare in una cartella richiede un browser che sappia aprirla — oggi quelli su base
          Chromium. I download restano comunque nell'app e si guardano offline da qui.
        </p>
      )}
    </div>
  );
}

function formatBytes(b: number) {
  if (!b) return '0 GB';
  const gb = b / 1024 ** 3;
  return `${gb.toFixed(1)} GB`;
}
