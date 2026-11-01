import { useState } from 'react';
import type { useWatchParty } from '../hooks/useWatchParty';
import { CloseIcon } from './Icons';
import { CrownIcon } from '../../components/icons';
import { t } from "../../lib/i18n";

type Props = { watchParty: ReturnType<typeof useWatchParty> };

const EMOJIS = ['😂', '😮', '❤️', '👏', '🔥'];

export default function WatchPartyPanel({ watchParty }: Props) {
  const {
    roomId, role, participants, messages, reactions, inviteLink,
    createRoom, joinRoom, leaveRoom, sendChat, sendReaction, kickParticipant, forceSyncAll,
  } = watchParty;
  const [joinCode, setJoinCode] = useState('');
  const [chatText, setChatText] = useState('');

  if (!roomId) {
    return (
      <div className="pv-panel pv-watchparty">
        <h3>{t("player_WatchPartyPanel.watch_party")}</h3>
        <button onClick={() => createRoom()}>{t("player_WatchPartyPanel.crea_stanza")}</button>
        <div className="pv-join-row">
          <input placeholder={t("player_WatchPartyPanel.codice_stanza")} value={joinCode} onChange={e => setJoinCode(e.target.value)} />
          <button className="pv-btn-secondary" onClick={() => joinCode && joinRoom(joinCode)}>{t("player_WatchPartyPanel.entra")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pv-panel pv-watchparty">
      <div className="pv-panel-header">
        <h3>{t("player_WatchPartyPanel.watch_party_2")} {participants.length} {participants.length === 1 ? t("player_WatchPartyPanel.partecipante") : t("player_WatchPartyPanel.partecipanti")}</h3>
        <button className="pv-icon-btn" aria-label={t("player_WatchPartyPanel.esci_dalla_stanza")} onClick={leaveRoom}><CloseIcon /></button>
      </div>

      <div className="pv-invite-row">
        <input readOnly value={inviteLink ?? ''} onFocus={e => e.target.select()} />
        <button onClick={() => inviteLink && navigator.clipboard?.writeText(inviteLink)}>{t("player_WatchPartyPanel.copia_link")}</button>
      </div>

      <ul className="pv-participants">
        {participants.map(p => (
          <li key={p.id}>
            <span className="pv-participant-name">
              {p.role === 'host' && <CrownIcon size={14} />}
              {p.name}
            </span>
            {role === 'host' && p.role !== 'host' && (
              <button className="pv-btn-tiny" onClick={() => kickParticipant(p.id)}>{t("player_WatchPartyPanel.rimuovi")}</button>
            )}
          </li>
        ))}
      </ul>

      {role === 'host' && (
        <button className="pv-btn-secondary" onClick={forceSyncAll}>{t("player_WatchPartyPanel.forza_sincronizzazione")}</button>
      )}

      <div className="pv-reactions-bar">
        {EMOJIS.map(e => (
          <button key={e} onClick={() => sendReaction(e)}>{e}</button>
        ))}
      </div>
      <div className="pv-reactions-float" aria-hidden>
        {reactions.map(r => <span key={r.id} className="pv-reaction-float">{r.emoji}</span>)}
      </div>

      <div className="pv-chat">
        <div className="pv-chat-messages">
          {messages.map(m => (
            <div key={m.id} className="pv-chat-message">
              <strong>{m.senderName}</strong> {m.text}
            </div>
          ))}
        </div>
        <form
          onSubmit={e => { e.preventDefault(); if (chatText.trim()) { sendChat(chatText); setChatText(''); } }}
        >
          <input value={chatText} onChange={e => setChatText(e.target.value)} placeholder={t("player_WatchPartyPanel.scrivi_un_messaggio")} />
          <button type="submit">{t("player_WatchPartyPanel.invia")}</button>
        </form>
      </div>
    </div>
  );
}
