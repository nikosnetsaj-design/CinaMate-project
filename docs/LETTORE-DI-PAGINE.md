# Il lettore di pagine, fatto in dieci minuti

Questa è la guida per la casella **Impostazioni → Indirizzi delle tue sorgenti →
Lettore di pagine**. Serve a far funzionare «Estrai il flusso» e «Pagina letta»
sui siti che, da soli, un browser non può leggere.

---

## Prima: perché serve, e perché non c'è un'alternativa furba

La domanda che si fanno tutti — *non si può fingersi un browser normale, o un
motore di ricerca, così il sito ci lascia entrare?* — ha una risposta secca, e
vale la pena capirla una volta invece di riprovarci in dieci modi.

**I due muri non li alza il sito: li alza il browser che stai usando.**

- **CORS.** CineMate chiede la pagina, il sito risponde — spesso perfettamente,
  `200` e l'HTML intero. È il *tuo* browser che, arrivata la risposta, si rifiuta
  di consegnarla al codice della pagina, perché il sito non ha scritto
  `Access-Control-Allow-Origin`. Il blocco avviene **dopo** la risposta, dalla
  nostra parte.
- **`X-Frame-Options`.** Idem: la pagina arriva, e il browser si rifiuta di
  disegnarla in un riquadro perché il sito ha scritto «non incorniciarmi».

Non c'è nessun buttafuori da ingannare: è una serratura sul lato interno della
porta di casa nostra. E non si può nemmeno tentare — `User-Agent` è un
*forbidden header*, e `fetch` in una pagina web si rifiuta di impostarlo proprio
perché il browser non vuole che una pagina menta su chi è.

**Dove invece l'idea funziona: qui.** Un lettore non è un browser, è un
programma che fa una richiesta HTTP. Lì lo `User-Agent` si scrive, e cambia
davvero cosa il sito risponde. Il trucco è giusto: va solo messo nel posto in cui
è possibile.

---

## Il lettore, da incollare

Un **Cloudflare Worker**: piano gratuito, nessuna carta, nessun server da tenere
acceso.

> **La strada breve è dentro l'app.** In *Impostazioni → Indirizzi delle tue
> sorgenti → Lettore di pagine* c'è il pulsante **«Non ne ho uno: come me lo
> faccio?»**: lì trovi lo stesso codice **con la parola segreta già dentro**,
> generata per questo dispositivo, e una casella in cui incollare l'indirizzo
> che Cloudflare restituisce — il modello completo lo scrive l'app. Due
> incollate e niente da correggere a mano. Quello che segue è la stessa cosa
> spiegata per esteso, per chi preferisce leggere prima.

1. Vai su [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers &
   Pages** → **Create** → **Start with Hello World** → **Deploy**.
2. Apri **Edit code**, cancella tutto e incolla questo (se copi da qui e non
   dall'app, la parola segreta cambiala tu):

```js
export default {
  async fetch(request) {
    const url = new URL(request.url);

    // ⬇️ CAMBIA QUESTA PAROLA. È l'unica cosa che impedisce a chiunque
    //    trovi il tuo indirizzo di usarlo come proxy a spese tue.
    const SEGRETO = "cambia-questa-parola";

    if (url.searchParams.get("k") !== SEGRETO) {
      return new Response("no", { status: 403 });
    }

    const target = url.searchParams.get("u");
    if (!target) return new Response("manca u", { status: 400 });

    let dest;
    try {
      dest = new URL(target);
      if (dest.protocol !== "http:" && dest.protocol !== "https:") throw new Error();
    } catch {
      return new Response("indirizzo non valido", { status: 400 });
    }

    const risposta = await fetch(dest.toString(), {
      redirect: "follow",
      headers: {
        // È QUI che ha senso presentarsi come un browser qualunque: da una
        // pagina web questo header non si può toccare, da qui sì. Molti siti
        // servono una pagina diversa — o non servono niente — a chi non
        // sembra una persona con un browser.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
      },
    });

    return new Response(risposta.body, {
      status: risposta.status,
      headers: {
        "content-type": risposta.headers.get("content-type") ?? "text/html; charset=utf-8",
        // La riga per cui esiste tutto questo.
        "access-control-allow-origin": "*",
        "cache-control": "no-store",
      },
    });
  },
};
```

3. **Deploy**. Cloudflare ti dà un indirizzo tipo
   `https://qualcosa.tuonome.workers.dev`.
4. In CineMate, **Impostazioni → Indirizzi delle tue sorgenti → Lettore di
   pagine**, incolla così — con la parola che hai scelto al posto di `SEGRETO`:

```
https://qualcosa.tuonome.workers.dev/?k=cambia-questa-parola&u={url}
```

Sotto la casella comparirà l'anteprima dell'indirizzo che chiederà per una
pagina d'esempio: se la vedi, il modello è scritto bene.

---

## Cosa cambia, e cosa no

**Comincia a funzionare:**

- «Estrai il flusso» nel Web Viewer, anche sui siti che prima rispondevano
  «non lascia leggere il sorgente».
- «Pagina letta», che è la risposta al riquadro bianco.
- La ricerca automatica sui **Siti** quando premi «Guarda» su un titolo: passa
  dalla stessa lettura, quindi eredita la stessa strada.

**Non cambia:**

- **La riproduzione del video.** Il flusso `.m3u8` lo chiede `hls.js`
  direttamente all'host, non passa dal lettore: se quell'host non manda CORS,
  il film non parte lo stesso. Il lettore serve a *trovare* l'indirizzo, non a
  far passare i byte del video. Far transitare un film intero da un Worker
  sarebbe anche il modo più rapido di esaurire il piano gratuito.
- **Le pagine costruite da JavaScript.** Il lettore consegna l'HTML così come il
  server lo manda. Se il player del sito si monta dopo, da uno script, quello
  che cerchi non è nel sorgente e non c'è lettura che lo faccia comparire.

---

## Tre avvertenze, dette prima e non dopo

1. **Il lettore vede ogni indirizzo che gli passi.** Uno tuo è una cosa fra te e
   il tuo Worker. Un servizio pubblico di terzi è una persona in mezzo che legge
   la tua navigazione: è il motivo per cui CineMate non ne propone nessuno e la
   casella parte vuota.
2. **Senza il segreto, è un proxy aperto.** Chiunque trovi l'indirizzo può
   usarlo per scaricare qualunque cosa, e le richieste risultano fatte da te.
   La riga `SEGRETO` non è decorativa. Se vuoi stringere ancora, sostituisci
   `"access-control-allow-origin": "*"` con l'indirizzo esatto da cui apri
   CineMate.
3. **Quello che leggi e cosa ne fai resta una tua responsabilità.** CineMate non
   ospita, non fornisce e non conosce alcun contenuto: è la stessa regola dei
   Link Host, e vale identica qui.
