import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useVideoPlayer } from '../hooks/useVideoPlayer';
import { usePlaybackExtras } from '../hooks/usePlaybackExtras';
import { useSubtitles } from '../hooks/useSubtitles';
import { useCast } from '../hooks/useCast';
import { usePlayerStats } from '../hooks/usePlayerStats';
import { getResumePosition, saveProgress } from '../services/statsAndHistory';
import { listDownloads } from '../services/downloadService';
import { useNetworkQuality } from '../hooks/useNetworkQuality';
import { usePlayerShortcuts } from '../hooks/usePlayerShortcuts';
import { usePlayerGestures } from '../hooks/usePlayerGestures';
import type { MediaContent } from '../types';
import type { useWatchParty } from '../hooks/useWatchParty';
import ControlsBar from './ControlsBar';
import ProgressBar from './ProgressBar';
import SettingsMenu from './SettingsMenu';
import PlayerIndicators from './PlayerIndicators';
import { SkipButton, NextUpOverlay, ErrorOverlay, SubtitleOverlay, EndScreenRecommendations, GestureOverlay } from './Overlays';
import type { Recommendation } from '../services/recommendationService';
import { PlayIcon, PauseIcon, ExpandIcon } from './Icons';

type Props = {
  content: MediaContent;
  onSelectContent: (id: string) => void;
  dataSaverMode?: boolean;
  watchParty?: ReturnType<typeof useWatchParty>;
  // From useHostMonitor, when the Host Manager feature is wired in (see
  // App.tsx). Origin drives seamless failover inside useVideoPlayer; name
  // is only used to show a small "in riproduzione da <host>" badge when
  // failover has switched away from the primary host.
  activeHostOrigin?: string | null;
  activeHostName?: string | null;
  isPrimaryHostActive?: boolean;
  /** Where end-screen suggestions come from. Defaults to the built-in service. */
  resolveRecommendations?: (content: MediaContent) => Promise<Recommendation[]>;
  /**
   * Hands the host app a way to read the playhead on demand.
   *
   * Deliberately a pull, not a push: a per-tick callback would fire several
   * times a second, and every consumer would then be reading a value that is
   * only as fresh as the last `timeupdate` event — which lags a seek, and stops
   * entirely while paused. Reading the element when the answer is actually
   * needed is both cheaper and exact.
   */
  onPlayerReady?: (api: { getCurrentTime: () => number }) => void;
  /** Shown as a badge — e.g. that playback is coming from local storage. */
  sourceLabel?: string | null;
  /** Fired once per title once enough of it has been watched to count. */
  onCompleted?: (contentId: string) => void;
};

export default function VideoPlayer({
  content,
  onSelectContent,
  dataSaverMode,
  watchParty,
  activeHostOrigin,
  activeHostName,
  isPrimaryHostActive = true,
  resolveRecommendations,
  onPlayerReady,
  sourceLabel,
  onCompleted,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<number | null>(null);
  const lastTouchRef = useRef(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isMini, setIsMini] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);

  const resumeSec = useMemo(() => getResumePosition(content.id), [content.id]);
  const nextContentId = content.nextEpisode?.id ?? content.nextInSaga?.id ?? null;

  const goToNext = useCallback(() => {
    setShowEndScreen(false);
    if (nextContentId) onSelectContent(nextContentId);
  }, [nextContentId, onSelectContent]);

  // Read before the player is created, so the very first hls.js instance is
  // already tuned for the connection rather than starting on a default and
  // correcting a moment later. Stalls are fed back in below.
  const network = useNetworkQuality();

  // The measured length, mirrored into a ref because `onProgress` is handed to
  // the player once, before `player.duration` exists — a closure over the state
  // would keep reporting the 0 it had at mount.
  const playerDurationRef = useRef(0);

  const player = useVideoPlayer(content, {
    dataSaverMode,
    startAtSec: resumeSec,
    activeHostOrigin,
    networkQuality: network.quality,
    // The length goes in with the position: without it "Continua a guardare"
    // could show a bar but never the minutes left, and a title whose runtime
    // was never filled in by hand would have no percentage at all.
    onProgress: (t) => { if (Math.floor(t) % 5 === 0) saveProgress(content.id, t, playerDurationRef.current); },
    onEnded: () => { if (nextContentId) goToNext(); else setShowEndScreen(true); },
  });

  useEffect(() => {
    if (player.isBuffering) network.reportStall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.isBuffering]);

  useEffect(() => {
    playerDurationRef.current = player.duration;
  }, [player.duration]);

  // The video element is owned by useVideoPlayer, so the accessor is published
  // once rather than re-published on every render of the page around it.
  useEffect(() => {
    onPlayerReady?.({ getCurrentTime: () => player.videoRef.current?.currentTime ?? 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPlayerReady]);

  const extras = usePlaybackExtras({
    content, currentTime: player.currentTime, duration: player.duration,
    isPlaying: player.isPlaying, onPlayNext: goToNext, onCompleted,
  });

  const subtitles = useSubtitles(content.subtitleTracks, player.currentTime);
  const cast = useCast(player.videoRef, content.manifestUrl, content.title);
  usePlayerStats(player.isPlaying);

  const [isDownloaded, setIsDownloaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    listDownloads().then(items => {
      if (!cancelled) setIsDownloaded(items.some(d => d.contentId === content.id && d.status === 'completed'));
    });
    return () => { cancelled = true; };
  }, [content.id]);

  // Seeks initiated locally (scrub bar, skip button) are also broadcast to the party.
  const handleUserSeek = useCallback((t: number) => {
    player.seek(t);
    watchParty?.notifyLocalSeek(t);
  }, [player, watchParty]);

  // Touch gestures on the picture. Routed through the same handleUserSeek as
  // every other seek, so a swipe in a Watch Party moves everyone exactly like
  // dragging the scrub bar does. Disabled in the mini player, where the whole
  // surface is barely larger than the two buttons it holds.
  const gestures = usePlayerGestures(player.videoRef, {
    getCurrentTime: () => player.videoRef.current?.currentTime ?? 0,
    getDuration: () => player.videoRef.current?.duration || player.duration,
    seek: handleUserSeek,
    setVolume: player.setVolume,
    togglePlay: player.togglePlay,
    enabled: !isMini,
  });

  useEffect(() => {
    if (!watchParty) return;
    watchParty.attachPlayer({
      getTime: () => player.currentTime,
      getIsPlaying: () => player.isPlaying,
      seek: player.seek,
      play: player.play,
      pause: player.pause,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchParty, player.currentTime, player.isPlaying]);

  const prevPlayingRef = useRef(player.isPlaying);
  useEffect(() => {
    if (!watchParty) return;
    if (player.isPlaying !== prevPlayingRef.current) {
      if (player.isPlaying) watchParty.notifyLocalPlay(player.currentTime);
      else watchParty.notifyLocalPause(player.currentTime);
      prevPlayingRef.current = player.isPlaying;
    }
  }, [player.isPlaying, player.currentTime, watchParty]);

  const scheduleHide = useCallback(() => {
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setControlsVisible(false), 3000);
  }, []);
  const handleActivity = useCallback(() => {
    setControlsVisible(true);
    if (player.isPlaying) scheduleHide();
  }, [player.isPlaying, scheduleHide]);
  useEffect(() => {
    handleActivity();
    return () => { if (idleTimer.current) window.clearTimeout(idleTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.isPlaying]);

  const handleSkip = () => extras.activeMarker && handleUserSeek(extras.activeMarker.endSec);
  const resumedBadge = resumeSec > 2 && player.currentTime < resumeSec + 3;

  // C cycles the subtitle tracks and then back off, which is more useful than a
  // plain on/off toggle when a title carries more than one language.
  const cycleSubtitles = useCallback(() => {
    const tracks = content.subtitleTracks;
    if (!tracks.length) return;
    const current = tracks.findIndex(t => t.id === subtitles.activeSubtitleId);
    const next = tracks[current + 1];
    subtitles.selectSubtitle(current === -1 ? tracks[0].id : (next?.id ?? null));
  }, [content.subtitleTracks, subtitles]);

  // Both of these read the live element rather than React state. State only
  // catches up when the browser fires `timeupdate`/`volumechange`, so two quick
  // presses of the same key would both start from the same stale value and the
  // second would undo the first: holding ↓ moved the volume one step, once.
  const handleShortcut = usePlayerShortcuts({
    togglePlay: player.togglePlay,
    // Goes through handleUserSeek, not player.seekBy, so a keyboard seek is
    // broadcast to the Watch Party exactly like one made with the scrub bar.
    seekBy: (delta) => handleUserSeek((player.videoRef.current?.currentTime ?? 0) + delta),
    nudgeVolume: (delta) => {
      const current = player.videoRef.current?.volume ?? 1;
      player.setVolume(Math.min(1, Math.max(0, current + delta)));
    },
    toggleMute: player.toggleMute,
    toggleFullscreen: () => player.toggleFullscreen(containerRef.current),
    toggleSubtitles: cycleSubtitles,
  });

  return (
    <div
      ref={containerRef}
      // Focusable so the shortcuts below reach it, and labelled because a bare
      // focusable div tells a screen reader nothing about what it just landed on.
      tabIndex={0}
      role="region"
      aria-label={`Player video — ${content.title}`}
      className={`pv-shell ${isMini ? 'pv-shell--mini' : ''} ${controlsVisible ? '' : 'pv-controls-hidden'}`}
      style={{ '--pv-picture-brightness': gestures.brightness } as CSSProperties}
      onMouseMove={handleActivity}
      onKeyDown={handleShortcut}
      onTouchStart={(e) => {
        handleActivity();
        gestures.handlers.onTouchStart(e);
      }}
      onTouchMove={gestures.handlers.onTouchMove}
      onTouchEnd={() => {
        // Browsers still fire a synthetic click ~300ms after a tap. Without
        // this stamp the tap would toggle playback twice — once through the
        // gesture handler, once through the picture's own onClick — which
        // reads as the tap having done nothing at all.
        lastTouchRef.current = Date.now();
        gestures.handlers.onTouchEnd();
      }}
      onClick={(e) => {
        handleActivity();
        // Clicking the picture should hand it the keyboard, the way it does in
        // every other player — but not steal focus from a control being used.
        if (e.target === e.currentTarget || e.target instanceof HTMLVideoElement) {
          containerRef.current?.focus();
        }
      }}
    >
      {/* A title with no poster on TMDB has no backdrop either; `url()` with an
          empty string makes the browser re-request the page itself. */}
      {content.backdropUrl && (
        <div className="pv-backdrop" style={{ backgroundImage: `url(${content.backdropUrl})` }} />
      )}
      {player.isBuffering && <div className="pv-skeleton" aria-hidden />}

      <video
        ref={player.videoRef}
        className="pv-video"
        onClick={() => {
          if (Date.now() - lastTouchRef.current < 500) return; // the tap already decided
          player.togglePlay();
        }}
        playsInline
        autoPlay
      />

      {!isMini && (
        <>
          <div className="pv-gradient-top" />
          <div className="pv-gradient-bottom" />

          <PlayerIndicators
            quality={player.levels.find(l => Number(l.id) === player.currentLevel)}
            isAuto={player.currentLevel === -1}
            audioLabel={player.audioTracks.find(a => Number(a.id) === player.currentAudioTrack)?.label}
            subtitleLabel={content.subtitleTracks.find(t => t.id === subtitles.activeSubtitleId)?.label}
            castDeviceName={cast.castDeviceName}
            resumed={resumedBadge}
            hostName={!isPrimaryHostActive ? activeHostName : null}
            isDownloaded={isDownloaded}
            networkQuality={network.quality}
            sourceLabel={sourceLabel}
          />

          <GestureOverlay feedback={gestures.feedback} />

          <SubtitleOverlay text={subtitles.activeCueText} style={subtitles.style} />

          {extras.activeMarker && <SkipButton marker={extras.activeMarker} onSkip={handleSkip} />}

          {extras.countdown !== null && nextContentId && (
            <NextUpOverlay
              seconds={extras.countdown}
              title={content.nextEpisode?.title ?? content.nextInSaga?.title ?? ''}
              posterUrl={content.nextEpisode?.posterUrl ?? content.nextInSaga?.posterUrl ?? ''}
              onCancel={extras.cancelAutoplay}
              onPlayNow={goToNext}
            />
          )}

          {showEndScreen && (
            <EndScreenRecommendations
              content={content}
              resolve={resolveRecommendations}
              onSelect={(id) => {
                setShowEndScreen(false);
                onSelectContent(id);
              }}
            />
          )}

          {player.error && <ErrorOverlay message={player.error} onRetry={player.retryPlayback} />}

          <ProgressBar
            currentTime={player.currentTime}
            duration={player.duration}
            bufferedEnd={player.bufferedEnd}
            skipMarkers={content.skipMarkers}
            thumbnailSprite={content.thumbnailSprite}
            onSeek={handleUserSeek}
          />

          <ControlsBar
            player={player}
            title={content.title}
            seriesTitle={content.seriesTitle}
            cast={cast}
            onOpenSettings={() => setSettingsOpen(true)}
            onToggleMini={() => setIsMini(true)}
            onToggleFullscreen={() => player.toggleFullscreen(containerRef.current)}
          />

          {settingsOpen && (
            <SettingsMenu
              levels={player.levels}
              currentLevel={player.currentLevel}
              onSelectLevel={player.setQualityLevel}
              audioTracks={player.audioTracks}
              currentAudioTrack={player.currentAudioTrack}
              onSelectAudio={player.setAudioTrack}
              subtitleTracks={content.subtitleTracks}
              activeSubtitleId={subtitles.activeSubtitleId}
              onSelectSubtitle={subtitles.selectSubtitle}
              subtitleStyle={subtitles.style}
              onUpdateSubtitleStyle={subtitles.updateStyle}
              playbackRate={player.playbackRate}
              onSelectRate={player.setPlaybackRate}
              dataSaver={!!dataSaverMode}
              onToggleDataSaver={player.setDataSaver}
              brightness={gestures.brightness}
              onSelectBrightness={gestures.adjustBrightness}
              bufferHealthSec={player.bufferHealthSec}
              bufferTargetSec={player.bufferTargetSec}
              onClose={() => setSettingsOpen(false)}
            />
          )}
        </>
      )}

      {isMini && (
        <div className="pv-mini-controls">
          <button className="pv-icon-btn" aria-label={player.isPlaying ? 'Pausa' : 'Play'} onClick={player.togglePlay}>
            {player.isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <span className="pv-mini-title">{content.title}</span>
          <button className="pv-icon-btn" aria-label="Esci dal mini player" onClick={() => setIsMini(false)}><ExpandIcon /></button>
        </div>
      )}
    </div>
  );
}
