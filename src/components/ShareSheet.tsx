import { useMemo, useState } from "react";
import { Sheet } from "./Sheet";
import { QrCode } from "./QrCode";
import { useLibrary } from "../store/useLibrary";
import { itemShareUrl, listShareUrl, shareOrCopy } from "../lib/share";
import type { Item } from "../types";

type Target =
  | { kind: "item"; item: Item }
  | { kind: "list"; name: string; items: Item[] };

const OUTCOME_TEXT: Record<"shared" | "copied" | "failed", string> = {
  shared: "Condiviso.",
  copied: "Link copiato negli appunti.",
  failed: "Non è stato possibile condividere. Copia il link a mano.",
};

/**
 * One sheet for both things you can send: a single title, or a whole list.
 *
 * The QR code exists for the case a link can't help with — the phone in your
 * hand and the television across the room have no way to pass a URL between
 * them, and reading one out loud is worse than pointing a camera at it.
 */
export function ShareSheet({ target, onClose }: { target: Target; onClose: () => void }) {
  const pushToast = useLibrary((s) => s.pushToast);
  const [copied, setCopied] = useState(false);

  const { url, title, subtitle } = useMemo(() => {
    if (target.kind === "item") {
      return {
        url: itemShareUrl(target.item),
        title: target.item.title,
        subtitle: "Il link apre questo titolo su un altro dispositivo.",
      };
    }
    return {
      url: listShareUrl(target.name, target.items),
      title: target.name,
      subtitle: `${target.items.length} titoli. La lista viaggia dentro il link: non passa da nessun server.`,
    };
  }, [target]);

  // A URL long enough to worry about is a real outcome here, not an edge case:
  // a hundred-title list encodes to several kilobytes, and both QR codes and
  // messaging apps have limits. Saying so beats producing a code that scans to
  // nothing.
  const tooLongForQr = url.length > 1200;

  const handleShare = async () => {
    const outcome = await shareOrCopy({
      title,
      text: target.kind === "list" ? `La mia lista: ${title}` : title,
      url,
    });
    if (outcome === "copied") setCopied(true);
    pushToast(outcome === "failed" ? "error" : "success", OUTCOME_TEXT[outcome]);
  };

  return (
    <Sheet onClose={onClose} titleId="share-title" maxWidthClass="max-w-sm">
      <div className="flex flex-col items-center gap-4 p-5 pt-8 sm:p-6">
        <div className="text-center">
          <h2 id="share-title" className="font-display text-xl font-semibold text-text">
            Condividi «{title}»
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-text-faint">{subtitle}</p>
        </div>

        {tooLongForQr ? (
          <p className="rounded-sm border border-border-strong px-3 py-2.5 text-center text-xs leading-relaxed text-text-muted">
            Questa lista è troppo lunga per un codice QR: il link resta valido, ma va inviato come
            link. Per il QR, condividi una lista più corta.
          </p>
        ) : (
          <QrCode value={url} size={216} label={`Codice QR per ${title}`} />
        )}

        <p className="w-full break-all rounded-sm border border-border bg-surface-2 px-3 py-2 font-mono text-[11px] leading-relaxed text-text-muted">
          {url}
        </p>

        <button
          type="button"
          onClick={handleShare}
          className="w-full rounded-sm py-2.5 text-sm font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
        >
          {copied ? "Copia di nuovo" : "Condividi o copia"}
        </button>
      </div>
    </Sheet>
  );
}
