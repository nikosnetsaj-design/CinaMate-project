import { useRef, useState, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import type { QualityLevel, AudioTrack, MediaContent } from '../types';

export type VideoPlayerOptions = {
  dataSaverMode?: boolean;
  startAtSec?: number;
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
  const retryCountRef = useRef(0);
  const attachRef = useRef<() => void>(() => {});
  // Read inside the xhrSetup callback below — kept in a ref (rather than a
  // dependency of the attach effect) so switching hosts never tears down
  // and recreates the Hls instance; only the next request onward is
  // redirected.
  const activeOriginRef = useRef<string | null>(options.activeHostOrigin ?? null);
  const isNativeRef = useRef(false);

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
  const [error, setError] = useState<string | null>(null);
  const [isPiP, setIsPiP] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Attach HLS / native source whenever the content changes.
  useEffect(() => {
    const video = videoRef.current;
    const media = content;
    if (!video || !media) return;

    setError(null);
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

      if (Hls.isSupported()) {
        isNativeRef.current = false;
        const hls = new Hls({
          maxBufferLength: 30,
          maxMaxBufferLength: 90,
          backBufferLength: 30,
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
        hls.autoLevelCapping = options.dataSaverMode ? 1 : -1;
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
          }
          if (options.startAtSec) v.currentTime = options.startAtSec;
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_evt, data) => setCurrentLevelState(data.level));
        hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_evt, data) => setCurrentAudioTrackState(data.id));

        // Automatic error handling + retry with exponential backoff, following
        // hls.js's recommended recovery pattern.
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (!data.fatal) return;
          if (retryCountRef.current >= MAX_RETRIES) {
            setError('Impossibile riprodurre il contenuto. Controlla la connessione e riprova.');
            options.onError?.('max_retries_exceeded');
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
        setError('Il tuo browser non supporta la riproduzione adattiva.');
      }
    }

    attachRef.current = attach;
    attach();

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content?.id]);

  // Native <video> event bindings.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      options.onProgress?.(video.currentTime, video.duration || 0);
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
      options.onEnded?.();
    };
    const onEnterPiP = () => setIsPiP(true);
    const onLeavePiP = () => setIsPiP(false);
    const onVolumeChange = () => {
      setVolumeState(video.volume);
      setMuted(video.muted);
    };
    const onRateChange = () => setPlaybackRateState(video.playbackRate);
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);

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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the ref xhrSetup reads in sync. A ref (not a dependency of the
  // attach effect) so switching hosts mid-stream never destroys/recreates
  // the Hls instance — see the xhrSetup comment above.
  useEffect(() => {
    activeOriginRef.current = options.activeHostOrigin ?? null;
  }, [options.activeHostOrigin]);

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

  const setVolume = useCallback((v: number) => {
    if (videoRef.current) videoRef.current.volume = v;
  }, []);
  const toggleMute = useCallback(() => {
    if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
  }, []);
  const setPlaybackRate = useCallback((rate: number) => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, []);

  // Quality change is seamless: hls.js swaps the level without reloading the video.
  const setQualityLevel = useCallback((levelId: number) => {
    if (hlsRef.current) hlsRef.current.currentLevel = levelId;
  }, []);
  const setAudioTrack = useCallback((id: number) => {
    if (hlsRef.current) hlsRef.current.audioTrack = id;
  }, []);
  const setDataSaver = useCallback((enabled: boolean) => {
    if (hlsRef.current) hlsRef.current.autoLevelCapping = enabled ? 1 : -1;
  }, []);

  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (document.pictureInPictureEnabled) await video.requestPictureInPicture();
    } catch {
      // PiP unsupported/blocked — UI should hide the button when unavailable.
    }
  }, []);

  const toggleFullscreen = useCallback(async (container?: HTMLElement | null) => {
    const el = container || videoRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      // fullscreen request rejected (e.g. not a user gesture) — ignore
    }
  }, []);

  const retryPlayback = useCallback(() => {
    retryCountRef.current = 0;
    setError(null);
    attachRef.current();
  }, []);

  return {
    videoRef,
    isPlaying, isBuffering, currentTime, duration, bufferedEnd,
    levels, currentLevel, audioTracks, currentAudioTrack,
    volume, muted, playbackRate, error, isPiP, isFullscreen,
    play, pause, togglePlay, seek, seekBy,
    setVolume, toggleMute, setPlaybackRate,
    setQualityLevel, setAudioTrack, setDataSaver,
    togglePiP, toggleFullscreen, retryPlayback,
  };
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
