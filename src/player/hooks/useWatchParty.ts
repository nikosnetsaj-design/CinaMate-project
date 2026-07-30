import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  WatchPartyParticipant,
  WatchPartyChatMessage,
  WatchPartyReaction,
  WatchPartySyncEvent,
  WatchPartyRole,
} from '../types';
import { BroadcastChannelTransport } from '../services/watchPartyTransport';
import type { WatchPartyTransport } from '../services/watchPartyTransport';

type PlayerBridge = {
  getTime: () => number;
  getIsPlaying: () => boolean;
  seek: (t: number) => void;
  play: () => void;
  pause: () => void;
};

export function useWatchParty(
  userId: string,
  userName: string,
  explicitTransport?: WatchPartyTransport
) {
  // The default transport must stay the SAME object across every re-render
  // of the calling component. A default parameter value (`= new
  // BroadcastChannelTransport()`) would be re-evaluated on every call —
  // i.e. a brand new, never-connected channel on every re-render — which
  // would silently break real-time sync as soon as anything else caused
  // the component to re-render. A ref guarantees it's constructed once.
  const defaultTransportRef = useRef<WatchPartyTransport | null>(null);
  if (!defaultTransportRef.current) defaultTransportRef.current = new BroadcastChannelTransport();
  const transport = explicitTransport ?? defaultTransportRef.current;

  const [roomId, setRoomId] = useState<string | null>(null);
  const [role, setRole] = useState<WatchPartyRole>('guest');
  const [participants, setParticipants] = useState<WatchPartyParticipant[]>([]);
  const [messages, setMessages] = useState<WatchPartyChatMessage[]>([]);
  const [reactions, setReactions] = useState<WatchPartyReaction[]>([]);
  const bridgeRef = useRef<PlayerBridge | null>(null);
  // Prevents a remote-triggered play/pause from being echoed straight back
  // out as if it were a fresh local action.
  const suppressEchoRef = useRef(false);

  const attachPlayer = useCallback((bridge: PlayerBridge) => {
    bridgeRef.current = bridge;
  }, []);

  const createRoom = useCallback(() => {
    const id = Math.random().toString(36).slice(2, 9);
    setRoomId(id);
    setRole('host');
    transport.connect(id);
    const me: WatchPartyParticipant = { id: userId, name: userName, role: 'host', joinedAt: Date.now() };
    setParticipants([me]);
    transport.send({ type: 'join', participant: me });
    return id;
  }, [transport, userId, userName]);

  const joinRoom = useCallback((id: string) => {
    setRoomId(id);
    setRole('guest');
    transport.connect(id);
    const me: WatchPartyParticipant = { id: userId, name: userName, role: 'guest', joinedAt: Date.now() };
    setParticipants(prev => [...prev, me]);
    transport.send({ type: 'join', participant: me });
    transport.send({ type: 'state_request', senderId: userId });
  }, [transport, userId, userName]);

  const leaveRoom = useCallback(() => {
    if (roomId) transport.send({ type: 'leave', participantId: userId });
    transport.disconnect();
    setRoomId(null);
    setParticipants([]);
    setMessages([]);
    setReactions([]);
  }, [transport, roomId, userId]);

  const inviteLink = roomId ? `${window.location.origin}${window.location.pathname}?party=${roomId}` : null;

  useEffect(() => {
    const unsub = transport.onMessage((event: WatchPartySyncEvent) => {
      switch (event.type) {
        case 'join':
          setParticipants(prev => (prev.some(p => p.id === event.participant.id) ? prev : [...prev, event.participant]));
          break;
        case 'leave':
          setParticipants(prev => prev.filter(p => p.id !== event.participantId));
          break;
        case 'chat':
          setMessages(prev => [...prev, event.message]);
          break;
        case 'reaction':
          setReactions(prev => [...prev.slice(-19), event.reaction]);
          break;
        case 'play':
          if (event.senderId === userId) break;
          suppressEchoRef.current = true;
          bridgeRef.current?.seek(event.time);
          bridgeRef.current?.play();
          break;
        case 'pause':
          if (event.senderId === userId) break;
          suppressEchoRef.current = true;
          bridgeRef.current?.seek(event.time);
          bridgeRef.current?.pause();
          break;
        case 'seek':
          if (event.senderId === userId) break;
          bridgeRef.current?.seek(event.time);
          break;
        case 'state_request':
          setRole(currentRole => {
            if (currentRole === 'host') {
              transport.send({
                type: 'state_response',
                time: bridgeRef.current?.getTime() ?? 0,
                isPlaying: bridgeRef.current?.getIsPlaying() ?? false,
                senderId: userId,
              });
            }
            return currentRole;
          });
          break;
        case 'state_response':
          suppressEchoRef.current = true;
          bridgeRef.current?.seek(event.time);
          if (event.isPlaying) bridgeRef.current?.play();
          else bridgeRef.current?.pause();
          break;
      }
    });
    return unsub;
  }, [transport, userId]);

  // Call these whenever the *local* user plays/pauses/seeks, so the action
  // gets broadcast to everyone else in the room.
  const notifyLocalPlay = useCallback((time: number) => {
    if (suppressEchoRef.current) {
      suppressEchoRef.current = false;
      return;
    }
    if (roomId) transport.send({ type: 'play', time, senderId: userId });
  }, [transport, roomId, userId]);

  const notifyLocalPause = useCallback((time: number) => {
    if (suppressEchoRef.current) {
      suppressEchoRef.current = false;
      return;
    }
    if (roomId) transport.send({ type: 'pause', time, senderId: userId });
  }, [transport, roomId, userId]);

  const notifyLocalSeek = useCallback((time: number) => {
    if (roomId) transport.send({ type: 'seek', time, senderId: userId });
  }, [transport, roomId, userId]);

  const sendChat = useCallback((text: string) => {
    if (!roomId || !text.trim()) return;
    const message: WatchPartyChatMessage = {
      id: crypto.randomUUID(), senderId: userId, senderName: userName, text: text.trim(), timestamp: Date.now(),
    };
    setMessages(prev => [...prev, message]);
    transport.send({ type: 'chat', message });
  }, [transport, roomId, userId, userName]);

  const sendReaction = useCallback((emoji: string) => {
    if (!roomId) return;
    const reaction: WatchPartyReaction = { id: crypto.randomUUID(), senderId: userId, emoji, timestamp: Date.now() };
    setReactions(prev => [...prev.slice(-19), reaction]);
    transport.send({ type: 'reaction', reaction });
  }, [transport, roomId, userId]);

  // Host-only controls.
  const kickParticipant = useCallback((participantId: string) => {
    if (role !== 'host') return;
    transport.send({ type: 'leave', participantId });
    setParticipants(prev => prev.filter(p => p.id !== participantId));
  }, [transport, role]);

  const forceSyncAll = useCallback(() => {
    if (role !== 'host' || !bridgeRef.current) return;
    transport.send({ type: 'seek', time: bridgeRef.current.getTime(), senderId: userId });
  }, [transport, role, userId]);

  return {
    roomId, role, participants, messages, reactions, inviteLink,
    createRoom, joinRoom, leaveRoom, attachPlayer,
    notifyLocalPlay, notifyLocalPause, notifyLocalSeek,
    sendChat, sendReaction, kickParticipant, forceSyncAll,
  };
}
