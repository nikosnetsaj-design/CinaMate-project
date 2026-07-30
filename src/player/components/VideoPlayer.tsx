import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useVideoPlayer } from '../hooks/useVideoPlayer';
import { usePlaybackExtras } from '../hooks/usePlaybackExtras';
import { useSubtitles } from '../hooks/useSubtitles';
import { useCast } from '../hooks/useCast';
import { usePlayerStats } from '../hooks/usePlayerStats';
import { getResumePosition, saveProgress } from '../services/statsAndHistory';
import { listDownloads } from '../services/downloadService';
import { useNetworkQuality } from '../hooks/useNetworkQuality';
import type { MediaContent } from '../types';
import type { useWatchParty } from '../hooks/useWatchParty';
import ControlsBar from './ControlsBar';
import ProgressBar from './ProgressBar';
import SettingsMenu from './SettingsMenu';
import PlayerIndicators from './PlayerIndicators';
import { SkipButton, NextUpOverlay, ErrorOverlay, SubtitleOverlay, EndScreenRecommendations } from './Overlays';
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
};

export default function VideoPlayer({
  content,
  onSelectContent,
  dataSaverMode,
  watchParty,
  activeHostOrigin,
  activeHostName,
  isPrimaryHostActive = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<number | null>(null);
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

  const player = useVideoPlayer(content, {
    dataSaverMode,
    startAtSec: resumeSec,
    activeHostOrigin,
    onProgress: (t) => { if (Math.floor(t) % 5 === 0) saveProgress(content.id, t); },
    onEnded: () => { if (nextContentId) goToNext(); else setShowEndScreen(true); },
  });

  const extras = usePlaybackExtras({
    content, currentTime: player.currentTime, duration: player.duration,
    isPlaying: player.isPlaying, onPlayNext: goToNext,
  });

  const subtitles = useSubtitles(content.subtitleTracks, player.currentTime);
  const cast = useCast(player.videoRef, content.manifestUrl, content.title);
  usePlayerStats(player.isPlaying);
  const networkQuality = useNetworkQuality(player.isBuffering);

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

  return (
    <div
      ref={containerRef}
      className={`pv-shell ${isMini ? 'pv-shell--mini' : ''} ${controlsVisible ? '' : 'pv-controls-hidden'}`}
      onMouseMove={handleActivity}
      onClick={handleActivity}
    >
      {/* A title with no poster on TMDB has no backdrop either; `url()` with an
          empty string makes the browser re-request the page itself. */}
      {content.backdropUrl && (
        <div className="pv-backdrop" style={{ backgroundImage: `url(${content.backdropUrl})` }} />
      )}
      {player.isBuffering && <div className="pv-skeleton" aria-hidden />}

      <video ref={player.videoRef} className="pv-video" onClick={player.togglePlay} playsInline autoPlay />

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
            networkQuality={networkQuality}
          />

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

          {showEndScreen && !nextContentId && <EndScreenRecommendations content={content} />}

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
              onClose={() => setSettingsOpen(false)}
            />
          )}
        </>
      )}

      {isMini && (
        <div className="pv-mini-controls">
          <button className="pv-icon-btn" onClick={player.togglePlay}>
            {player.isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <span className="pv-mini-title">{content.title}</span>
          <button className="pv-icon-btn" onClick={() => setIsMini(false)}><ExpandIcon /></button>
        </div>
      )}
    </div>
  );
}
