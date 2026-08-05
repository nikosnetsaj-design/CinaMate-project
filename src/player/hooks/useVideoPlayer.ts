import { useRef, useState, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import type { MediaPlayerClass } from 'dashjs';
import type { QualityLevel, AudioTrack, MediaContent, NetworkQuality } from '../types';
import { getPlaybackPrefs, normaliseLang, setPlaybackPrefs } from '../services/playbackPrefs';
import { describeFailure, type PlayerFailure } from '../services/playerErrors';
import { isDashUrl } from '../services/manifestKind';

export type VideoPlayerOptions = {
  dataSaverMode?: boolean;
  startAtSec?: number;
  /**
   * Drives the adaptive buffer below. Read live, so a connection that
   * degrades mid-film re-tunes the buffer without reloading anything.
   */
  networkQuality?: NetworkQuality;
  // Origin (e.g. "https://cdn2.example.com") of the currently-active stream
  // host from useHostMonitor. When set and different from the content's own
  // manifest origin, every hls.js request gets transparently redirected
  // there — see the xhrSetup hook below for how this stays seamless.
  activeHostOrigin?: string | null;
  onProgress?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onError?: (message: string) => void;
};

const MAX_RETRIES = 5;


// ---------------------------------------------------------------------------
// Adaptive buffering.
//
// The instinct is "bad network → buffer less", and it is backwards. A forward
// buffer is the only thing standing between a dropout and a stall, so a weak
// connection wants the *largest* cap it can fill, not the smallest: the cap
// costs nothing when bandwidth can't reach it and saves the playback when a
// tunnel or a lift takes the link away for ten seconds. What a good connection
// buys instead is the freedom to hold less — faster seeks, less memory, and no
// megabytes fetched for a title that gets abandoned two minutes in.
//
// `backBufferLength` moves the other way: already-played segments are pure
// memory cost, worth keeping only when re-fetching them would be expensive.
//
// Data saver overrides all of it. Its whole point is not spending bytes
// speculatively, so it keeps the smallest buffer that still plays smoothly.
// ---------------------------------------------------------------------------
type BufferProfile = {
  maxBufferLength: number;
  maxMaxBufferLength: number;
  backBufferLength: number;
};

const BUFFER_PROFILES: Record<NetworkQuality, BufferProfile> = {
  offline: { maxBufferLength: 60, maxMaxBufferLength: 240, backBufferLength: 10 },
  poor: { maxBufferLength: 60, maxMaxBufferLength: 180, backBufferLength: 15 },
  good: { maxBufferLength: 30, maxMaxBufferLength: 90, backBufferLength: 30 },
  excellent: { maxBufferLength: 20, maxMaxBufferLength: 60, backBufferLength: 30 },
};

const DATA_SAVER_PROFILE: BufferProfile = {
  maxBufferLength: 15,
  maxMaxBufferLength: 30,
  backBufferLength: 10,
};

function bufferProfileFor(quality: NetworkQuality | undefined, dataSaver: boolean | undefined): BufferProfile {
  if (dataSaver) return DATA_SAVER_PROFILE;
  return BUFFER_PROFILES[quality ?? 'good'];
}

/**
 * The WebKit-only members iOS Safari exposes in place of the standard
 * Fullscreen and Picture-in-Picture APIs. Declared here rather than globally so
 * the non-standard surface stays visible where it is actually used.
 */
type WebkitVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitPresentationMode?: string;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => void;
};

// Swaps only the origin (protocol + host + port) of `originalUrl` for the
// one in `newOrigin`, keeping path/query/hash untouched. Falls back to the
// original URL if either string doesn't parse — malformed host config
// should never be able to break playback.
function rewriteOrigin(originalUrl: string, newOrigin: string): string {
  try {
    const original = new URL(originalUrl);
    const replacement = new URL(newOrigin);
    original.protocol = replacement.protocol;
    original.host = replacement.host;
    return original.toString();
  } catch {
    return originalUrl;
  }
}

export function useVideoPlayer(content: MediaContent | null, options: VideoPlayerOptions = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  // Il motore DASH vive accanto a quello HLS, mai insieme: `attach()` ne
  // distrugge sempre uno prima di costruire l'altro. L'elenco degli id delle
  // rappresentazioni serve a tradurre l'indice che usa l'interfaccia — pensata
  // su hls.js, dove i livelli sono numerati — nell'identificatore con cui
  // dash.js le chiama.
  const dashRef = useRef<MediaPlayerClass | null>(null);
  const dashLevelsRef = useRef<QualityLevel[]>([]);
  // Cresce a ogni attacco: il caricamento di dash.js è asincrono, e questo è
  // ciò che permette di riconoscere un modulo arrivato dopo un cambio di titolo.
  const attachTokenRef = useRef(0);
  const retryCountRef = useRef(0);
  const attachRef = useRef<() => void>(() => {});
  // Read inside the xhrSetup callback below — kept in a ref (rather than a
  // dependency of the attach effect) so switching hosts never tears down
  // and recreates the Hls instance; only the next request onward is
  // redirected.
  const activeOriginRef = useRef<string | null>(options.activeHostOrigin ?? null);
  const isNativeRef = useRef(false);

  // The `<video>` event listeners are attached once, for the life of the hook,
  // so they must not close over `options` directly: the caller passes a fresh
  // object literal on every render, and the listeners would keep calling the
  // callbacks from the very first one. That made `onProgress` save the playhead
  // under whichever title was selected when the player first mounted, and
  // `onEnded` navigate to *that* title's next episode. Reading through a ref
  // that is refreshed on every render keeps them current.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [currentLevel, setCurrentLevelState] = useState(-1); // -1 = auto (adaptive)
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [currentAudioTrack, setCurrentAudioTrackState] = useState(-1);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [failure, setFailure] = useState<PlayerFailure | null>(null);
  const [isPiP, setIsPiP] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Attach HLS / native source whenever the content changes.
  useEffect(() => {
    const video = videoRef.current;
    const media = content;
    if (!video || !media) return;

    setFailure(null);
    retryCountRef.current = 0;

    // `video`/`media` are re-bound to locals inside attach() because
    // TypeScript does not carry null-narrowing from the outer closure into a
    // nested function declaration.
    function attach() {
      const v = video as HTMLVideoElement;
      const c = media as MediaContent;

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (dashRef.current) {
        dashRef.current.destroy();
        dashRef.current = null;
        dashLevelsRef.current = [];
      }

      if (isDashUrl(c.manifestUrl)) {
        // dash.js pesa quanto hls.js, e i manifest `.mpd` sono la minoranza:
        // caricarlo solo qui significa che chi riproduce HLS — quasi tutti —
        // non lo scarica mai. Stesso motivo per cui il player intero è una
        // rotta a caricamento differito.
        isNativeRef.current = false;
        const token = ++attachTokenRef.current;
        const origin = activeOriginRef.current;
        const url = origin ? rewriteOrigin(c.manifestUrl, origin) : c.manifestUrl;

        import('dashjs')
          .then(({ MediaPlayer }) => {
            // Arrivato tardi: nel frattempo si è cambiato titolo o si è usciti
            // dal player. Senza questo controllo il modulo appena caricato si
            // attaccherebbe a un elemento che non è più quello giusto.
            if (token !== attachTokenRef.current) return;
            const player = MediaPlayer().create();
            dashRef.current = player;
            player.initialize(v, url, false, options.startAtSec ?? 0);

            player.on('streamInitialized', () => {
              const reps = player.getRepresentationsByType('video').map((r) => ({
                id: r.id,
                height: r.height,
                bitrate: r.bandwidth,
                label: labelForHeight(r.height, r.bandwidth),
              }));
              dashLevelsRef.current = reps;
              setLevels(reps);
              // Come nel ramo HLS: il tetto si applica qui, quando la scala è
              // finalmente nota, non prima che esista.
              applyDashCap(player, reps, getPlaybackPrefs().maxHeight, optionsRef.current.dataSaverMode);

              const audio = player.getTracksFor('audio');
              if (audio.length > 1) {
                setAudioTracks(
                  audio.map((t, i) => ({
                    id: String(i),
                    language: t.lang || 'und',
                    label: t.labels?.[0]?.text || t.lang || `Traccia ${i + 1}`,
                  }))
                );
                // Stessa regola del ramo HLS: la lingua che scegli sempre,
                // scelta per te, invece del primo doppiaggio del manifest.
                const wanted = normaliseLang(getPlaybackPrefs().audioLang);
                const match = audio.find((t) => normaliseLang(t.lang ?? '') === wanted);
                if (wanted && match) player.setCurrentTrack(match);
              }
            });

            player.on('error', (e) => {
              setFailure({
                message: 'Questo flusso DASH non parte.',
                hint:
                  (e as { error?: { message?: string } }).error?.message ||
                  'Controlla che l\'indirizzo del manifest .mpd sia raggiungibile e che il server permetta le richieste da questa pagina (CORS).',
                transient: false,
              });
              optionsRef.current.onError?.('dash_error');
            });
          })
          .catch(() => {
            if (token !== attachTokenRef.current) return;
            setFailure({
              message: 'Non riesco a caricare il lettore DASH.',
              hint: 'Serve la rete al primo flusso .mpd che apri: il modulo si scarica in quel momento. Riprova quando torna la connessione.',
              transient: true,
            });
          });
        return;
      }

      if (Hls.isSupported()) {
        isNativeRef.current = false;
        const hls = new Hls({
          ...bufferProfileFor(optionsRef.current.networkQuality, optionsRef.current.dataSaverMode),
          capLevelToPlayerSize: true,
          // Seamless host failover: hls.js resolves every playlist/segment
          // URL against the manifest's own origin, but xhrSetup fires
          // *before* the request is actually opened, so re-opening the XHR
          // here with a different origin redirects the request without
          // hls.js ever knowing — buffer, level, and playback position are
          // completely undisturbed. Requires the mirrored hosts to serve
          // byte-identical content at the same paths.
          xhrSetup: (xhr, url) => {
            const origin = activeOriginRef.current;
            if (origin) xhr.open('GET', rewriteOrigin(url, origin), true);
          },
        });
        hlsRef.current = hls;
        // The real cap is applied on MANIFEST_PARSED, once the renditions are
        // known; this only makes sure data saver is in force for the very first
        // segment, before there is a ladder to choose from.
        if (optionsRef.current.dataSaverMode) hls.autoLevelCapping = 1;
        hls.loadSource(c.manifestUrl);
        hls.attachMedia(v);

        hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data) => {
          setLevels(
            data.levels.map((l, i) => ({
              id: String(i),
              height: l.height,
              bitrate: l.bitrate,
              label: labelForHeight(l.height, l.bitrate),
            }))
          );
          if (hls.audioTracks?.length) {
            setAudioTracks(
              hls.audioTracks.map((t, i) => ({
                id: String(i),
                language: t.lang || 'und',
                label: t.name || t.lang || `Traccia ${i + 1}`,
              }))
            );

            // The dub you always pick, picked for you. Without this, a series
            // whose tracks happen to start on the original language makes you
            // reopen the menu at the top of every single episode.
            const wanted = normaliseLang(getPlaybackPrefs().audioLang);
            if (wanted) {
              const match = hls.audioTracks.findIndex((t) => normaliseLang(t.lang) === wanted);
              if (match >= 0 && match !== hls.audioTrack) hls.audioTrack = match;
            }
          }

          // A ceiling on the adaptive ladder, kept across titles: on a metered
          // connection "never above 720p" is a decision made once, not one to
          // re-make every time something starts.
          applyLevelCap(hls, getPlaybackPrefs().maxHeight, optionsRef.current.dataSaverMode);

          if (options.startAtSec) v.currentTime = options.startAtSec;
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_evt, data) => setCurrentLevelState(data.level));
        hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_evt, data) => setCurrentAudioTrackState(data.id));

        // Automatic error handling + retry with exponential backoff, following
        // hls.js's recommended recovery pattern.
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (!data.fatal) return;
          const described = describeFailure(data);
          // A failure that waiting cannot fix is reported at once instead of
          // after five rounds of backoff: retrying a 404 five times only means
          // twenty seconds of staring at a black rectangle before being told
          // the same thing.
          if (!described.transient || retryCountRef.current >= MAX_RETRIES) {
            setFailure(described);
            optionsRef.current.onError?.(described.transient ? 'max_retries_exceeded' : (data.details ?? 'fatal'));
            return;
          }
          const attempt = retryCountRef.current + 1;
          retryCountRef.current = attempt;
          const backoff = Math.min(1000 * 2 ** attempt, 8000);
          setTimeout(() => {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                attach();
            }
          }, backoff);
        });
      } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari plays HLS natively — there's no request-interception hook
        // available here (that's entirely inside the OS media engine), so
        // this path can only redirect via a full src reload later (see the
        // effect below), not seamlessly like the hls.js path above.
        isNativeRef.current = true;
        const origin = activeOriginRef.current;
        v.src = origin ? rewriteOrigin(c.manifestUrl, origin) : c.manifestUrl;
        if (options.startAtSec) v.currentTime = options.startAtSec;
      } else {
        setFailure({
          message: 'Questo browser non sa riprodurre flussi adattivi.',
          hint: 'Serve il supporto a Media Source Extensions. Aggiorna il browser, oppure aprilo in Chrome, Firefox o Safari recenti.',
          transient: false,
        });
      }
    }

    attachRef.current = attach;
    attach();

    return () => {
      attachTokenRef.current += 1;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      dashRef.current?.destroy();
      dashRef.current = null;
      dashLevelsRef.current = [];
    };
    // Keyed on the address as well as the id: the same title can change source
    // — a pattern resolving to a different host, or switching to a download —
    // and keying on the id alone left hls.js attached to the address it was
    // first given, so the new one was never loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content?.id, content?.manifestUrl]);

  // Native <video> event bindings.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      optionsRef.current.onProgress?.(video.currentTime, video.duration || 0);
    };
    const onDurationChange = () => setDuration(video.duration || 0);
    const onProgress = () => {
      if (video.buffered.length) setBufferedEnd(video.buffered.end(video.buffered.length - 1));
    };
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => {
      setIsBuffering(false);
      setIsPlaying(true);
    };
    const onPauseEvt = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      optionsRef.current.onEnded?.();
    };
    const onEnterPiP = () => setIsPiP(true);
    const onLeavePiP = () => setIsPiP(false);
    const onVolumeChange = () => {
      setVolumeState(video.volume);
      setMuted(video.muted);
    };
    const onRateChange = () => setPlaybackRateState(video.playbackRate);
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    // iOS never sets document.fullscreenElement, so its own begin/end events
    // are the only way to know the OS player was dismissed.
    const onWebkitBegin = () => setIsFullscreen(true);
    const onWebkitEnd = () => setIsFullscreen(false);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('progress', onProgress);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPauseEvt);
    video.addEventListener('ended', onEnded);
    video.addEventListener('enterpictureinpicture', onEnterPiP);
    video.addEventListener('leavepictureinpicture', onLeavePiP);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('ratechange', onRateChange);
    document.addEventListener('fullscreenchange', onFsChange);
    video.addEventListener('webkitbeginfullscreen', onWebkitBegin);
    video.addEventListener('webkitendfullscreen', onWebkitEnd);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPauseEvt);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('enterpictureinpicture', onEnterPiP);
      video.removeEventListener('leavepictureinpicture', onLeavePiP);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('ratechange', onRateChange);
      document.removeEventListener('fullscreenchange', onFsChange);
      video.removeEventListener('webkitbeginfullscreen', onWebkitBegin);
      video.removeEventListener('webkitendfullscreen', onWebkitEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preferences that belong to *you*, not to a title: volume, mute and speed
  // are applied to every new element, so the fifth episode of an evening starts
  // exactly like the fourth ended. Written back below, so a change made here
  // teaches the next title too.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const prefs = getPlaybackPrefs();
    video.volume = prefs.volume;
    video.muted = prefs.muted;
    video.playbackRate = prefs.playbackRate;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content?.id]);

  /**
   * Comes back by itself when the connection does.
   *
   * Without this, a tunnel or a lift ends the evening: the backoff chain runs
   * out while there is genuinely no network, and what is left is a dead player
   * that needed a manual retry at the exact moment the network returned on its
   * own. The listener costs nothing and turns the most common failure of mobile
   * viewing into a two-second pause.
   */
  useEffect(() => {
    const onOnline = () => {
      const hls = hlsRef.current;
      retryCountRef.current = 0;
      if (hls) {
        setFailure(null);
        hls.startLoad();
      } else if (dashRef.current || isNativeRef.current) {
        // dash.js non ha un `startLoad()` equivalente: si riattacca, e il punto
        // di ripresa lo rimette `startAtSec`.
        attachRef.current();
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  // Keep the ref xhrSetup reads in sync. A ref (not a dependency of the
  // attach effect) so switching hosts mid-stream never destroys/recreates
  // the Hls instance — see the xhrSetup comment above.
  useEffect(() => {
    activeOriginRef.current = options.activeHostOrigin ?? null;
  }, [options.activeHostOrigin]);

  // Re-tune the buffer when the connection changes. Mutating `hls.config` in
  // place is what makes this seamless: the buffer and stream controllers read
  // these three values on every tick, so the new caps take effect from the
  // next segment onward with nothing torn down and no reload.
  const [bufferProfile, setBufferProfile] = useState<BufferProfile>(() =>
    bufferProfileFor(options.networkQuality, options.dataSaverMode)
  );
  useEffect(() => {
    const profile = bufferProfileFor(options.networkQuality, options.dataSaverMode);
    setBufferProfile(profile);
    const hls = hlsRef.current;
    if (!hls) return;
    hls.config.maxBufferLength = profile.maxBufferLength;
    hls.config.maxMaxBufferLength = profile.maxMaxBufferLength;
    hls.config.backBufferLength = profile.backBufferLength;
  }, [options.networkQuality, options.dataSaverMode]);

  // Native-Safari fallback: no request-interception hook exists for the
  // OS media engine, so the only way to redirect it is a full source
  // reload. This does cause a brief stall — unlike the hls.js path above,
  // true seamlessness isn't possible here — but it's still far better than
  // getting stuck on a dead host. Position and play state are preserved.
  useEffect(() => {
    const video = videoRef.current;
    const origin = options.activeHostOrigin;
    if (!video || !content || !origin || !isNativeRef.current) return;
    const rewritten = rewriteOrigin(content.manifestUrl, origin);
    if (rewritten === video.src) return;
    const wasPlaying = !video.paused;
    const resumeAt = video.currentTime;
    video.src = rewritten;
    video.currentTime = resumeAt;
    if (wasPlaying) video.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.activeHostOrigin, content?.id]);

  const play = useCallback(() => {
    videoRef.current?.play().catch(() => {
      // Autoplay can be blocked by the browser — the play button remains available.
    });
  }, []);
  const pause = useCallback(() => videoRef.current?.pause(), []);
  const togglePlay = useCallback(() => (isPlaying ? pause() : play()), [isPlaying, play, pause]);

  const seek = useCallback((sec: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(sec, video.duration || sec));
  }, []);
  const seekBy = useCallback((deltaSec: number) => {
    if (videoRef.current) seek(videoRef.current.currentTime + deltaSec);
  }, [seek]);

  // Each of these writes the preference as well as the element: the value is
  // saved where it was decided, so nothing has to remember to mirror it later.
  const setVolume = useCallback((v: number) => {
    if (!videoRef.current) return;
    videoRef.current.volume = v;
    // Nudging the slider up from silence is how people unmute; leaving `muted`
    // set would make that move do nothing at all.
    if (v > 0 && videoRef.current.muted) videoRef.current.muted = false;
    setPlaybackPrefs({ volume: v, muted: videoRef.current.muted });
  }, []);
  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setPlaybackPrefs({ muted: videoRef.current.muted });
  }, []);
  const setPlaybackRate = useCallback((rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackPrefs({ playbackRate: rate });
  }, []);

  // Quality change is seamless: hls.js swaps the level without reloading the video.
  const setQualityLevel = useCallback((levelId: number) => {
    if (hlsRef.current) hlsRef.current.currentLevel = levelId;
    const dash = dashRef.current;
    if (!dash) return;
    // −1 è "automatica" in entrambi i mondi, ma si dice in due modi diversi:
    // hls.js ha un livello speciale, dash.js ha un interruttore dell'ABR.
    if (levelId < 0) {
      dash.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: true } } } });
      return;
    }
    const id = dashLevelsRef.current[levelId]?.id;
    if (!id) return;
    dash.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: false } } } });
    dash.setRepresentationForTypeById('video', id);
  }, []);
  const setAudioTrack = useCallback((id: number) => {
    const dash = dashRef.current;
    if (dash) {
      const track = dash.getTracksFor('audio')[id];
      if (!track) return;
      dash.setCurrentTrack(track);
      if (track.lang) setPlaybackPrefs({ audioLang: normaliseLang(track.lang) });
      return;
    }
    const hls = hlsRef.current;
    if (!hls) return;
    hls.audioTrack = id;
    // Remembered by language rather than by index: track 2 is a different dub
    // on every title, but "italiano" is the same answer everywhere.
    const lang = hls.audioTracks?.[id]?.lang;
    if (lang) setPlaybackPrefs({ audioLang: normaliseLang(lang) });
  }, []);
  const setDataSaver = useCallback((enabled: boolean) => {
    if (hlsRef.current) applyLevelCap(hlsRef.current, getPlaybackPrefs().maxHeight, enabled);
    applyDashCap(dashRef.current, dashLevelsRef.current, getPlaybackPrefs().maxHeight, enabled);
  }, []);

  /** Ceiling on automatic quality, kept for every title until changed. */
  const setMaxHeight = useCallback((height: number | null) => {
    setPlaybackPrefs({ maxHeight: height });
    if (hlsRef.current) applyLevelCap(hlsRef.current, height, optionsRef.current.dataSaverMode);
    applyDashCap(dashRef.current, dashLevelsRef.current, height, optionsRef.current.dataSaverMode);
  }, []);

  // ---------------------------------------------------------------------
  // Fullscreen and Picture in Picture, with the WebKit paths iPhones need.
  //
  // iOS Safari implements neither standard API: `Element.requestFullscreen`
  // does not exist there at all, and `document.pictureInPictureEnabled` is
  // false. Both buttons therefore did nothing on an iPhone, leaving only the
  // in-page mini player — which is plain CSS and works anywhere. The WebKit
  // equivalents live on the <video> element instead of on a container, so
  // fullscreen on iOS hands over to the OS player rather than blowing up our
  // own shell; that is the only fullscreen iOS offers.
  // ---------------------------------------------------------------------
  const togglePiP = useCallback(async () => {
    const video = videoRef.current as WebkitVideoElement | null;
    if (!video) return;
    try {
      if (document.pictureInPictureEnabled) {
        if (document.pictureInPictureElement) await document.exitPictureInPicture();
        else await video.requestPictureInPicture();
        return;
      }
      if (video.webkitSupportsPresentationMode?.('picture-in-picture')) {
        const next = video.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture';
        video.webkitSetPresentationMode?.(next);
      }
    } catch {
      // Blocked (no user gesture, or the OS refused) — the button stays put.
    }
  }, []);

  const toggleFullscreen = useCallback(async (container?: HTMLElement | null) => {
    const video = videoRef.current as WebkitVideoElement | null;
    const el = (container || videoRef.current) as FullscreenElement | null;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        return;
      }
      // Older WebKit desktop path, then iOS, which only ever fullscreens the
      // video itself.
      if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
        return;
      }
      if (video?.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
        setIsFullscreen(true);
      }
    } catch {
      // fullscreen request rejected (e.g. not a user gesture) — ignore
    }
  }, []);

  /** Whether this browser can do it at all, so the UI can hide what it can't. */
  const pipSupported =
    typeof document !== 'undefined' &&
    (document.pictureInPictureEnabled ||
      !!(videoRef.current as WebkitVideoElement | null)?.webkitSupportsPresentationMode);
  const fullscreenSupported =
    typeof document !== 'undefined' &&
    (document.fullscreenEnabled ||
      !!(videoRef.current as WebkitVideoElement | null)?.webkitEnterFullscreen);

  const retryPlayback = useCallback(() => {
    retryCountRef.current = 0;
    setFailure(null);
    attachRef.current();
  }, []);

  // Seconds of playable video already downloaded ahead of the playhead, and
  // how much the current profile is aiming for — the pair is what makes the
  // adaptive buffer legible in the UI instead of an invisible tuning knob.
  const bufferHealthSec = Math.max(0, bufferedEnd - currentTime);

  return {
    videoRef,
    isPlaying, isBuffering, currentTime, duration, bufferedEnd,
    bufferHealthSec, bufferTargetSec: bufferProfile.maxBufferLength,
    levels, currentLevel, audioTracks, currentAudioTrack,
    volume, muted, playbackRate, isPiP, isFullscreen,
    // `error` stays a plain string for every caller that only wants to know
    // *whether* something broke; `failure` carries the diagnosis.
    error: failure?.message ?? null,
    failure,
    play, pause, togglePlay, seek, seekBy,
    setVolume, toggleMute, setPlaybackRate,
    setQualityLevel, setAudioTrack, setDataSaver, setMaxHeight,
    togglePiP, toggleFullscreen, retryPlayback,
    pipSupported, fullscreenSupported,
  };
}

/**
 * Applies the quality ceiling to hls.js's automatic ladder.
 *
 * Data saver is not a separate mechanism but the strictest possible ceiling, so
 * the two are resolved here together — otherwise turning data saver off would
 * silently discard a 720p ceiling the user had also set.
 */
/**
 * Lo stesso tetto del ramo HLS, detto nella lingua di dash.js.
 *
 * Là si cappa l'indice della scala; qui si dichiara un'altezza massima e la
 * scelta della rappresentazione resta all'ABR. Il risultato per chi guarda è
 * identico — "mai sopra i 720p" — e il risparmio dati è la stessa cosa con il
 * tetto messo al minimo che il formato conosce.
 */
function applyDashCap(
  dash: MediaPlayerClass | null,
  levels: QualityLevel[],
  maxHeight: number | null,
  dataSaver: boolean | undefined,
) {
  if (!dash) return;
  const setCap = (kbit: number) => dash.updateSettings({ streaming: { abr: { maxBitrate: { video: kbit } } } });

  // Nessun tetto: -1 è come dash.js dice "prendi pure la migliore".
  if (!dataSaver && !maxHeight) {
    setCap(-1);
    return;
  }
  if (levels.length === 0) return;

  const lowest = levels.reduce((min, l) => (l.bitrate < min.bitrate ? l : min), levels[0]);
  if (dataSaver) {
    setCap(Math.ceil(lowest.bitrate / 1000));
    return;
  }

  // Il gradino più alto che sta ancora sotto il tetto; se sono tutte sopra, la
  // più piccola è la risposta onesta — la stessa regola del ramo HLS, detta in
  // bitrate perché è l'unica manopola che dash.js espone.
  const under = levels.filter((l) => l.height <= (maxHeight ?? 0));
  const chosen = under.length > 0 ? under.reduce((best, l) => (l.height > best.height ? l : best), under[0]) : lowest;
  setCap(Math.ceil(chosen.bitrate / 1000));
}

function applyLevelCap(hls: Hls, maxHeight: number | null, dataSaver: boolean | undefined) {
  if (dataSaver) {
    hls.autoLevelCapping = 1;
    return;
  }
  if (!maxHeight) {
    hls.autoLevelCapping = -1;
    return;
  }
  // The highest rung that still fits under the ceiling; if every rendition is
  // above it, the smallest one is the honest answer.
  let best = -1;
  let bestHeight = -1;
  hls.levels.forEach((level, index) => {
    if (level.height <= maxHeight && level.height > bestHeight) {
      best = index;
      bestHeight = level.height;
    }
  });
  if (best === -1 && hls.levels.length > 0) {
    best = hls.levels.reduce((lowest, level, index, all) => (level.height < all[lowest].height ? index : lowest), 0);
  }
  hls.autoLevelCapping = best;
}

// A media playlist without EXT-X-STREAM-INF (a single-rendition source, which
// is what a hand-rolled manifest usually is) carries no resolution at all, and
// hls.js reports height 0. Labelling that "0p" reads like a broken stream, so
// fall back to the bitrate — the one thing such a rendition does declare.
function labelForHeight(h: number, bitrate: number): string {
  if (h >= 4320) return '8K';
  if (h >= 2160) return '4K';
  if (h >= 1080) return '1080p';
  if (h >= 720) return '720p';
  if (h >= 480) return '480p';
  if (h > 0) return `${h}p`;
  return bitrate > 0 ? `${Math.round(bitrate / 1000)} kbps` : 'Unica';
}
