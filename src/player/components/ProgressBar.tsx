import { useState, useRef, useCallback } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { SkipMarker, ThumbnailSprite } from '../types';

type Props = {
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  skipMarkers: SkipMarker[];
  thumbnailSprite?: ThumbnailSprite;
  onSeek: (t: number) => void;
};

export default function ProgressBar({ currentTime, duration, bufferedEnd, skipMarkers, thumbnailSprite, onSeek }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState(0);

  const pct = (v: number) => (duration ? Math.min(100, (v / duration) * 100) : 0);

  const timeFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el || !duration) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * duration;
  }, [duration]);

  const handleMove = (e: ReactMouseEvent) => {
    // .pv-scrub-preview is absolutely positioned against .pv-progress-wrap, so
    // hoverX must be measured relative to that element, not the viewport.
    const wrapRect = wrapRef.current?.getBoundingClientRect();
    setHoverX(wrapRect ? e.clientX - wrapRect.left : null);
    setHoverTime(timeFromClientX(e.clientX));
  };
  const handleClick = (e: ReactMouseEvent) => onSeek(timeFromClientX(e.clientX));

  const tile = thumbnailSprite && hoverX !== null
    ? Math.min(thumbnailSprite.count - 1, Math.max(0, Math.floor(hoverTime / thumbnailSprite.interval)))
    : null;
  const tileCol = tile !== null && thumbnailSprite ? tile % thumbnailSprite.columns : 0;
  const tileRow = tile !== null && thumbnailSprite ? Math.floor(tile / thumbnailSprite.columns) : 0;

  return (
    <div className="pv-progress-wrap" ref={wrapRef}>
      {hoverX !== null && (
        <div className="pv-scrub-preview" style={{ left: hoverX }}>
          {thumbnailSprite && tile !== null && (
            <div
              className="pv-thumb"
              style={{
                width: thumbnailSprite.tileWidth,
                height: thumbnailSprite.tileHeight,
                backgroundImage: `url(${thumbnailSprite.url})`,
                backgroundPosition: `-${tileCol * thumbnailSprite.tileWidth}px -${tileRow * thumbnailSprite.tileHeight}px`,
              }}
            />
          )}
          <span className="pv-scrub-time">{formatTime(hoverTime)}</span>
        </div>
      )}

      <div
        ref={trackRef}
        className="pv-progress-track"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverX(null)}
        onClick={handleClick}
      >
        <div className="pv-progress-buffered" style={{ width: `${pct(bufferedEnd)}%` }} />
        <div className="pv-progress-played" style={{ width: `${pct(currentTime)}%` }} />
        {skipMarkers.map((m, i) => (
          <div
            key={i}
            className={`pv-marker pv-marker-${m.type}`}
            style={{ left: `${pct(m.startSec)}%`, width: `${pct(m.endSec - m.startSec)}%` }}
          />
        ))}
        <div className="pv-progress-handle" style={{ left: `${pct(currentTime)}%` }} />
      </div>
    </div>
  );
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
