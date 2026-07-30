import type { useMarathonMode } from '../hooks/useMarathonMode';

type Props = { marathon: ReturnType<typeof useMarathonMode>; onJumpTo: (index: number) => void };

export default function MarathonBar({ marathon, onJumpTo }: Props) {
  const { completionPercent, remainingSec, index, current, hasNext, next } = marathon;
  if (!current) return null;

  return (
    <div className="pv-marathon-bar">
      <div className="pv-marathon-track">
        <div className="pv-marathon-fill" style={{ width: `${completionPercent}%` }} />
      </div>
      <div className="pv-marathon-info">
        <span className="pv-mono">Maratona · {completionPercent.toFixed(0)}%</span>
        <span className="pv-dim">Rimangono {formatDuration(remainingSec)}</span>
        {hasNext && (
          <button className="pv-btn-tiny" onClick={() => { next(); onJumpTo(index + 1); }}>
            Prossimo ▸
          </button>
        )}
      </div>
    </div>
  );
}

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
