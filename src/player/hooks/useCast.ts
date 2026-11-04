import { useState, useEffect, useCallback, useRef } from 'react';
import type { RefObject } from 'react';

/*
 * Il minimo dell'SDK di Google Cast e di AirPlay che questo file usa davvero.
 * L'SDK arriva da uno script esterno senza tipi: scriverne solo la parte
 * usata tiene il compilatore utile senza inventare un'API intera.
 */
interface CastSession {
  getCastDevice(): { friendlyName?: string } | null;
  loadMedia(request: CastLoadRequest): Promise<unknown> | void;
}

interface CastContextInstance {
  setOptions(options: { receiverApplicationId: string; autoJoinPolicy: string }): void;
  addEventListener(type: string, handler: (event: { sessionState: string }) => void): void;
  getCurrentSession(): CastSession | null;
  requestSession(): Promise<unknown>;
}

interface CastFramework {
  CastContext: { getInstance(): CastContextInstance };
  CastContextEventType: { SESSION_STATE_CHANGED: string };
  SessionState: { SESSION_STARTED: string; SESSION_RESUMED: string };
}

interface CastMediaInfo {
  metadata: { title?: string } | null;
}

interface CastLoadRequest {
  currentTime: number;
}

interface ChromeCast {
  media: {
    DEFAULT_MEDIA_RECEIVER_APP_ID: string;
    MediaInfo: new (contentId: string, contentType: string) => CastMediaInfo;
    GenericMediaMetadata: new () => { title?: string };
    LoadRequest: new (mediaInfo: CastMediaInfo) => CastLoadRequest;
  };
  AutoJoinPolicy: { ORIGIN_SCOPED: string };
}

declare global {
  interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    chrome?: { cast?: ChromeCast };
    cast?: { framework?: CastFramework };
    WebKitPlaybackTargetAvailabilityEvent?: unknown;
  }
  interface HTMLVideoElement {
    webkitShowPlaybackTargetPicker?: () => void;
  }
}

// The ref comes straight from useVideoPlayer's `useRef<HTMLVideoElement |
// null>(null)`, so the null has to stay in the type: React 19 no longer
// widens RefObject<T> to allow a null current.
export function useCast(videoRef: RefObject<HTMLVideoElement | null>, manifestUrl: string | null, title: string) {
  const [castAvailable, setCastAvailable] = useState(false);
  const [castConnected, setCastConnected] = useState(false);
  const [castDeviceName, setCastDeviceName] = useState<string | null>(null);
  const [airPlayAvailable, setAirPlayAvailable] = useState(false);
  const sessionRef = useRef<CastSession | null>(null);

  // Load the Google Cast Sender SDK once per app lifetime, and wire up this
  // hook instance to the cast context whenever it becomes available.
  useEffect(() => {
    const setupCastContext = () => {
      const framework = window.cast?.framework;
      const chromeCast = window.chrome?.cast;
      if (!framework || !chromeCast) return;
      const context = framework.CastContext.getInstance();
      context.setOptions({
        receiverApplicationId: chromeCast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
        autoJoinPolicy: chromeCast.AutoJoinPolicy.ORIGIN_SCOPED,
      });
      setCastAvailable(true);

      context.addEventListener(
        framework.CastContextEventType.SESSION_STATE_CHANGED,
        (e) => {
          const connected =
            e.sessionState === framework.SessionState.SESSION_STARTED ||
            e.sessionState === framework.SessionState.SESSION_RESUMED;
          setCastConnected(connected);
          sessionRef.current = connected ? context.getCurrentSession() : null;
          setCastDeviceName(connected ? sessionRef.current?.getCastDevice()?.friendlyName ?? null : null);
        }
      );
    };

    // The SDK (and its global callback) only ever fires once per page load.
    // If a previous VideoPlayer instance already loaded and initialized it —
    // e.g. the user advanced to the next episode and this hook remounted —
    // window.cast is already sitting there ready, so set up immediately
    // instead of waiting for a callback that will never fire again.
    if (window.cast?.framework) {
      setupCastContext();
      return;
    }

    window.__onGCastApiAvailable = (isAvailable: boolean) => {
      if (isAvailable) setupCastContext();
    };

    if (!document.getElementById('cast-sender-sdk')) {
      const script = document.createElement('script');
      script.id = 'cast-sender-sdk';
      script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
      document.head.appendChild(script);
    }
  }, []);

  // AirPlay availability — WebKit/Safari only.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !window.WebKitPlaybackTargetAvailabilityEvent) return;
    const handler = (e: Event) => setAirPlayAvailable((e as Event & { availability?: string }).availability === 'available');
    video.addEventListener('webkitplaybacktargetavailabilitychanged', handler);
    return () => video.removeEventListener('webkitplaybacktargetavailabilitychanged', handler);
  }, [videoRef]);

  const openCastPicker = useCallback(() => {
    if (!castAvailable) return;
    void window.cast?.framework?.CastContext.getInstance().requestSession();
  }, [castAvailable]);

  const openAirPlayPicker = useCallback(() => {
    videoRef.current?.webkitShowPlaybackTargetPicker?.();
  }, [videoRef]);

  const castMedia = useCallback((currentTimeSec: number) => {
    const media = window.chrome?.cast?.media;
    if (!sessionRef.current || !manifestUrl || !media) return;
    const mediaInfo = new media.MediaInfo(manifestUrl, 'application/x-mpegurl');
    const metadata = new media.GenericMediaMetadata();
    metadata.title = title;
    mediaInfo.metadata = metadata;
    const request = new media.LoadRequest(mediaInfo);
    request.currentTime = currentTimeSec;
    sessionRef.current.loadMedia(request);
  }, [manifestUrl, title]);

  // As soon as a cast session connects, hand off playback to the receiver
  // from the exact local timestamp, then pause locally — this is what makes
  // "cambio dispositivo senza interrompere la visione" seamless. Extending
  // this with cast.framework.RemotePlayerController lets you mirror the
  // remote's position back for a full round-trip handoff.
  useEffect(() => {
    if (castConnected && videoRef.current) {
      castMedia(videoRef.current.currentTime);
      videoRef.current.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [castConnected]);

  return { castAvailable, castConnected, castDeviceName, airPlayAvailable, openCastPicker, openAirPlayPicker };
}
