import { lazy, Suspense, useMemo, useState } from "react";
import { Sheet } from "./Sheet";
import { useLibrary } from "../store/useLibrary";
import { itemShareUrl, listShareUrl, shareOrCopy } from "../lib/share";
import type { Item } from "../types";
import { t } from "../lib/i18n";

/**
 * The QR encoder is only ever needed by this sheet, so it loads with it rather
 * than with the app. It is small, but "small" repeated across every feature is
 * how a launch gets slow — and nothing about opening the library needs it.
 */
const QrCode = lazy(() => import("./QrCode").then((m) => ({ default: m.QrCode })));

type Target =
  | { kind: "item"; item: Item }
  | { kind: "list"; name: string; items: Item[] };

const OUTCOME_TEXT: Record<"shared" | "copied" | "failed", string> = {
  shared: t("ShareSheet.condiviso"),
  copied: t("ShareSheet.link_copiato_negli_appunti"),
  failed: t("ShareSheet.non_e_stato_possibile"),
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
        subtitle: t("ShareSheet.il_link_apre_questo"),
      };
    }
    return {
      url: listShareUrl(target.name, target.items),
      title: target.name,
      subtitle: t("ShareSheet.titoli_la_lista_viaggia", { v0: target.items.length }),
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
      text: target.kind === "list" ? t("ShareSheet.la_mia_lista", { v0: title }) : title,
      url,
    });
    if (outcome === "copied") setCopied(true);
    pushToast(outcome === "failed" ? "error" : "success", OUTCOME_TEXT[outcome]);
  };

  return (
    <Sheet onClose={onClose} titleId="share-title" maxWidthClass="max-w-sm">
      <div className="flex flex-col items-center gap-4 p-5 pt-8 sm:p-6">
        <div className="text-center">
          <h2 id="share-title" className="t-title text-text">
            {t("ShareSheet.condividi")}{title}»
          </h2>
          <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
        </div>

        {tooLongForQr ? (
          <p className="rounded-md bg-surface-2 px-4 py-3 text-center text-sm text-text-muted">
            {t("ShareSheet.questa_lista_e_troppo")}
          </p>
        ) : (
          <Suspense fallback={<div className="skeleton h-[216px] w-[216px] rounded-sm" aria-hidden />}>
            <QrCode value={url} size={216} label={t("ShareSheet.codice_qr_per", { v0: title })} />
          </Suspense>
        )}

        <p className="w-full break-all rounded-md bg-surface-2 px-4 py-3 font-mono text-xs leading-relaxed text-text-muted">
          {url}
        </p>

        <button
          type="button"
          onClick={handleShare}
          className="btn btn-primary w-full"
        >
          {copied ? t("ShareSheet.copia_di_nuovo") : t("ShareSheet.condividi_o_copia")}
        </button>
      </div>
    </Sheet>
  );
}
