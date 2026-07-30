import { useState, useEffect } from 'react';
import { useDownloadManager } from '../hooks/useDownloadManager';
import { getWatchStatus } from '../services/statsAndHistory';
import type { MediaContent, DownloadQuality } from '../types';

const QUALITIES: { id: DownloadQuality; label: string }[] = [
  { id: 'sd', label: 'SD' }, { id: 'hd', label: 'HD' }, { id: 'fullhd', label: 'Full HD' }, { id: '4k', label: '4K' },
];

const STATUS_LABELS: Record<string, string> = {
  queued: 'In coda', downloading: 'In corso', paused: 'In pausa', completed: 'Completato', error: 'Errore',
};

export default function DownloadManagerUI({ library }: { library: MediaContent[] }) {
  const { downloads, storage, download, downloadSeason, pause, resume, remove } = useDownloadManager();
  const [autoDelete, setAutoDelete] = useState(true);
  const [pickerFor, setPickerFor] = useState<MediaContent | null>(null);

  const usedPct = storage.quota ? (storage.usage / storage.quota) * 100 : 0;

  // Best-effort: once autoDelete is on, free space for anything finished
  // that the watch-history service has since marked as completed.
  useEffect(() => {
    if (!autoDelete) return;
    downloads.forEach(d => {
      if (d.status === 'completed' && getWatchStatus(d.contentId) === 'completed') remove(d.id);
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

      <div className="pv-download-catalog">
        {library.map(item => (
          <div key={item.id} className="pv-download-row">
            {item.posterUrl && <img src={item.posterUrl} alt="" />}
            <span>{item.title}</span>
            <button className="pv-btn-secondary" onClick={() => setPickerFor(item)}>Scarica</button>
          </div>
        ))}
        {library.length > 1 && (
          <button className="pv-btn-secondary" onClick={() => downloadSeason(library, 'hd')}>
            Scarica stagione completa (HD)
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
            <button className="pv-btn-tiny" onClick={() => remove(d.id)}>Elimina</button>
          </li>
        ))}
        {downloads.length === 0 && <li className="pv-dim">Nessun download in corso.</li>}
      </ul>
    </div>
  );
}

function formatBytes(b: number) {
  if (!b) return '0 GB';
  const gb = b / 1024 ** 3;
  return `${gb.toFixed(1)} GB`;
}
