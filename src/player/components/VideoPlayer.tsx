import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useVideoPlayer } from '../hooks/useVideoPlayer';
import { usePlaybackExtras } from '../hooks/usePlaybackExtras';
import { useSubtitles } from '../hooks/useSubtitles';
import { useCast } from '../hooks/useCast';
import { usePlayerStats } from '../hooks/usePlayerStats';
import { useProgressSaver } from '../hooks/useProgressSaver';
import { useMediaSession } from '../hooks/useMediaSession';
import { useWakeLock } from '../hooks/useWakeLock';
import { useSleepTimer } from '../hooks/useSleepTimer';
import { getResumePosition } from '../services/statsAndHistory';
import { getPlaybackPrefs, setPlaybackPrefs, PREFS_EVENT, type PlaybackPrefs } from '../services/playbackPrefs';
import { listDownloads } from '../services/downloadService';
import { useNetworkQuality } from '../hooks/useNetworkQuality';
import { usePlayerShortcuts } from '../hooks/usePlayerShortcuts';
import { usePlayerGestures } from '../hooks/usePlayerGestures';
import type { MediaContent, Reaction } from '../types';
import type { useWatchParty } from '../hooks/useWatchParty';
import ControlsBar from './ControlsBar';
import ProgressBar from './ProgressBar';
import SettingsMenu from './SettingsMenu';
import type { SettingsTab } from './SettingsMenu';
import PlayerIndicators from './PlayerIndicators';
import PlayerTopBar from './PlayerTopBar';
import CenterTransport from './CenterTransport';
import BrightnessRail from './BrightnessRail';
import RatingCard from './RatingCard';
import EpisodesPanel from './EpisodesPanel';
import type { PlaylistEntry } from './EpisodesPanel';
import ClipSheet from './ClipSheet';
import type { ClipResult } from './ClipSheet';
import { SkipButton, PostPlayOverlay, ErrorOverlay, SubtitleOverlay, EndScreenRecommendations, GestureOverlay, AutoSkipNote } from './Overlays';
import ResumeBar from './ResumeBar';
import ShortcutsHelp from './ShortcutsHelp';
import type { Recommendation } from '../services/recommendationService';
import { PlayIcon, PauseIcon, ExpandIcon, UnlockIcon } from './Icons';

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
  /**
   * L'etichetta in cima alla scena: "S2:E10 «Braccata come dai segugi»". La
   * costruisce chi ospita il player, che è l'unico a sapere a che punto della
   * serie si trova; senza, resta il titolo così com'è.
   */
  label?: string;
  /** Il voto già dato a questo titolo, tradotto nei tre gesti. */
  reaction?: Reaction | null;
  /** Assente per un contenuto che la libreria non conosce (lo stream di test). */
  onReact?: (reaction: Reaction) => void;
  /** Dove torna la X in alto a destra. Assente: la X non compare. */
  onClose?: () => void;
  /** Cos'altro c'è da riprodurre, per il pannello "Episodi". */
  playlist?: PlaylistEntry[];
  /** Come si condivide un momento — vedi ClipSheet. */
  onShareMoment?: (startSec: number, lengthSec: number) => Promise<ClipResult>;
  /**
   * Un punto d'inizio chiesto esplicitamente — di norma un collegamento a un
   * momento condiviso. Vince sul segnalibro salvato: chi ha aperto quel link
   * vuole quel secondo, non l'ultimo dove si era fermato.
   */
  startAtSec?: number | null;
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
  label,
  reaction = null,
  onReact,
  onClose,
  playlist,
  onShareMoment,
  startAtSec = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<number | null>(null);
  const lastTouchRef = useRef(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isMini, setIsMini] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [episodesOpen, setEpisodesOpen] = useState(false);
  /** Il secondo da cui parte il momento da condividere, o null a foglio chiuso. */
  const [clipStart, setClipStart] = useState<number | null>(null);
  /**
   * Comandi bloccati: un film si guarda tenendo il telefono in mano, e ogni
   * tocco involontario è una pausa o un salto di dieci secondi. Da bloccato la
   * scena non risponde più a niente tranne al lucchetto stesso.
   */
  const [locked, setLocked] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resumeDismissed, setResumeDismissed] = useState(false);

  // The cross-title preferences, mirrored into state so every panel that shows
  // them redraws when one of them changes it.
  const [prefs, setPrefs] = useState<PlaybackPrefs>(getPlaybackPrefs);
  useEffect(() => {
    const sync = () => setPrefs(getPlaybackPrefs());
    window.addEventListener(PREFS_EVENT, sync);
    return () => window.removeEventListener(PREFS_EVENT, sync);
  }, []);
  const updatePrefs = useCallback((patch: Partial<PlaybackPrefs>) => setPlaybackPrefs(patch), []);

  const savedResumeSec = useMemo(() => getResumePosition(content.id), [content.id]);
  // Un punto chiesto dal collegamento non è una ripresa: la barra "riprendi da"
  // non ha nulla da offrire, perché è già lì che il video sta partendo.
  const resumeSec = startAtSec ?? savedResumeSec;
  const askedForPoint = startAtSec != null;
  useEffect(() => setResumeDismissed(false), [content.id]);
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
    // The playhead is written by useProgressSaver below, on a real clock and
    // at every moment the value is about to be lost — not from here, which
    // fires several times a second and never once after a pause.
    onEnded: () => { if (nextContentId && prefs.autoplayNext) goToNext(); else setShowEndScreen(true); },
  });

  useEffect(() => {
    if (player.isBuffering) network.reportStall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.isBuffering]);

  useEffect(() => {
    playerDurationRef.current = player.duration;
  }, [player.duration]);

  // Reads the element, not React state: a flush on `pagehide` has to report
  // where the playhead is *now*, and state is only as fresh as the last
  // `timeupdate` the browser bothered to fire before the page went away.
  useProgressSaver(
    content.id,
    useCallback(
      () => ({
        time: player.videoRef.current?.currentTime ?? 0,
        duration: player.videoRef.current?.duration ?? playerDurationRef.current,
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    ),
    player.isPlaying,
  );

  // The video element is owned by useVideoPlayer, so the accessor is published
  // once rather than re-published on every render of the page around it.
  useEffect(() => {
    onPlayerReady?.({ getCurrentTime: () => player.videoRef.current?.currentTime ?? 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPlayerReady]);

  // "Fine episodio" on the sleep timer: the countdown must not run tonight.
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const sleep = useSleepTimer(player.pause, setAutoplayBlocked);

  const extras = usePlaybackExtras({
    content, currentTime: player.currentTime, duration: player.duration,
    isPlaying: player.isPlaying, onPlayNext: goToNext, onCompleted,
    seek: player.seek, blockAutoplay: autoplayBlocked,
  });

  // The lock is tied to playback, not to the page: a paused player has no claim
  // on someone's battery.
  const wakeLock = useWakeLock(prefs.keepScreenAwake && player.isPlaying);

  useMediaSession(content, player.isPlaying, player.duration, player.currentTime, {
    play: player.play,
    pause: player.pause,
    seekTo: player.seek,
    seekBy: player.seekBy,
    next: nextContentId ? goToNext : null,
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
    enabled: !isMini && !locked,
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

  /**
   * Il cartello della classificazione vive nei primi secondi e poi sparisce da
   * solo, come al cinema. Legato al tempo del video e non a un timer: chi mette
   * in pausa per leggerlo se lo tiene davanti finché non riparte, e chi torna
   * all'inizio lo rivede, che è esattamente quando serve.
   */
  const showRatingCard = !!content.rating && player.currentTime < 7 && !showEndScreen;

  /** Ritagliare vuol dire scegliere un punto: il video si ferma su quel punto. */
  const openClip = useCallback(() => {
    player.pause();
    setClipStart(player.videoRef.current?.currentTime ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.pause]);

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
    seekToFraction: (fraction) => {
      const total = player.videoRef.current?.duration || player.duration;
      if (total) handleUserSeek(total * fraction);
    },
    nudgeVolume: (delta) => {
      const current = player.videoRef.current?.volume ?? 1;
      player.setVolume(Math.min(1, Math.max(0, current + delta)));
    },
    nudgeRate: (delta) => {
      const current = player.videoRef.current?.playbackRate ?? 1;
      player.setPlaybackRate(Math.min(4, Math.max(0.25, Math.round((current + delta) * 100) / 100)));
    },
    toggleMute: player.toggleMute,
    toggleFullscreen: () => player.toggleFullscreen(containerRef.current),
    toggleSubtitles: cycleSubtitles,
    togglePiP: player.togglePiP,
    toggleHelp: () => setHelpOpen((v) => !v),
    playNext: nextContentId ? goToNext : null,
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
      // Da bloccato la tastiera tace come tace il tocco: metà blocco sarebbe
      // peggio di nessun blocco.
      onKeyDown={locked ? undefined : handleShortcut}
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
          if (locked) return; // il blocco vale prima di tutto il resto
          if (Date.now() - lastTouchRef.current < 500) return; // the tap already decided
          player.togglePlay();
        }}
        playsInline
        autoPlay
      />

      {/* Da bloccato resta solo il lucchetto, e compare con lo stesso gesto che
          altrove fa apparire i comandi: toccare la scena. */}
      {locked && !isMini && (
        <div className="pv-lock-layer">
          <button
            type="button"
            className="pv-lock-btn"
            aria-label="Sblocca i comandi"
            onClick={() => setLocked(false)}
          >
            <UnlockIcon />
            <span>Comandi bloccati</span>
          </button>
        </div>
      )}

      {!isMini && !locked && (
        <>
          <div className="pv-gradient-top" />
          <div className="pv-gradient-bottom" />

          <PlayerTopBar
            label={label ?? (content.seriesTitle ? `${content.seriesTitle} — ${content.title}` : content.title)}
            reaction={reaction}
            onReact={onReact}
            cast={cast}
            onLock={() => setLocked(true)}
            onClose={onClose}
          />

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
            sleepAtEnd={sleep.choice === 'end-of-episode'}
            sleepMinutes={sleep.remainingSec != null ? Math.ceil(sleep.remainingSec / 60) : null}
          />

          {showRatingCard && content.rating && <RatingCard rating={content.rating} />}

          <GestureOverlay feedback={gestures.feedback} />

          <BrightnessRail value={gestures.brightness} onChange={gestures.adjustBrightness} />

          {/* Al centro solo quando al centro non c'è già altro da leggere: la
              schermata di fine e l'errore occupano la stessa area, e due strati
              sovrapposti sono peggio di nessuno dei due. */}
          {!showEndScreen && !player.failure && (
            <CenterTransport
              isPlaying={player.isPlaying}
              onTogglePlay={player.togglePlay}
              onSeekBy={(delta) => handleUserSeek((player.videoRef.current?.currentTime ?? 0) + delta)}
            />
          )}

          <SubtitleOverlay text={subtitles.activeCueText} style={subtitles.style} />

          {/* The button only appears when the skip is still a question. With
              auto-skip on, the marker has already been jumped and offering to
              jump it again would be nonsense. */}
          {extras.activeMarker && prefs.autoSkip === 'manual' && (
            <SkipButton marker={extras.activeMarker} onSkip={handleSkip} />
          )}
          {extras.autoSkipped && <AutoSkipNote type={extras.autoSkipped} />}

          {!askedForPoint && resumeSec > 30 && !resumeDismissed && player.currentTime < resumeSec + 12 && (
            <ResumeBar
              positionSec={resumeSec}
              onRestart={() => {
                handleUserSeek(0);
                setResumeDismissed(true);
              }}
              onDismiss={() => setResumeDismissed(true)}
            />
          )}

          {extras.countdown !== null && nextContentId && (
            <PostPlayOverlay
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

          {player.failure && <ErrorOverlay failure={player.failure} onRetry={player.retryPlayback} />}

          <ControlsBar
            player={player}
            progress={
              <ProgressBar
                currentTime={player.currentTime}
                duration={player.duration}
                bufferedEnd={player.bufferedEnd}
                skipMarkers={content.skipMarkers}
                thumbnailSprite={content.thumbnailSprite}
                onSeek={handleUserSeek}
              />
            }
            onOpenSettings={setSettingsTab}
            onOpenEpisodes={() => setEpisodesOpen(true)}
            hasEpisodes={(playlist?.length ?? 0) > 1}
            onOpenClip={openClip}
            onNext={nextContentId ? goToNext : null}
            onToggleMini={() => setIsMini(true)}
            onToggleFullscreen={() => player.toggleFullscreen(containerRef.current)}
          />

          {episodesOpen && playlist && (
            <EpisodesPanel
              entries={playlist}
              currentId={content.id}
              onSelect={onSelectContent}
              onClose={() => setEpisodesOpen(false)}
            />
          )}

          {clipStart !== null && onShareMoment && (
            <ClipSheet
              startSec={clipStart}
              title={content.title}
              onShare={onShareMoment}
              onClose={() => setClipStart(null)}
            />
          )}

          {settingsTab && (
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
              prefs={prefs}
              onUpdatePrefs={updatePrefs}
              onSelectMaxHeight={player.setMaxHeight}
              sleep={sleep}
              wakeLockSupported={wakeLock.supported}
              initialTab={settingsTab}
              onClose={() => setSettingsTab(null)}
            />
          )}

          {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} />}
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
