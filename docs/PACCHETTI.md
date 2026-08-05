# Pacchetti nativi

### Cosa si può confezionare, cosa serve per farlo, e cosa non si può fare da qui

CineMate è una pagina installabile: su qualunque apparecchio con un browser
moderno si apre e si aggiunge alla schermata Home senza confezionare niente.
Questo documento riguarda l'altra strada — un file da scaricare o da mettere in
uno store — e dice per ognuna delle quattro piattaforme che cosa serve davvero.

**Una premessa che vale per tutte.** Nessuno di questi pacchetti contiene
un'applicazione diversa: dentro c'è la stessa pagina, nella webview del sistema.
È una scelta, non una scorciatoia — due basi di codice per la stessa app
divergono alla seconda modifica, e la differenza la pagherebbe chi usa quella
meno curata.

---

## Riepilogo

| Piattaforma | Come | Si costruisce in CI | Cosa serve di tuo |
|---|---|---|---|
| **Desktop** (Windows, macOS, Linux) | Tauri 2 | ✅ `.github/workflows/pacchetti.yml` | niente per provarlo; un certificato per non far comparire l'avviso di sicurezza |
| **Android** (telefoni, tablet) | Trusted Web Activity, Bubblewrap | ✅ stesso workflow | un portachiavi di firma, nei segreti del progetto |
| **Fire TV** | ❌ non con la TWA | — | vedi sotto: la strada è un'altra, e forse non serve |
| **iOS / iPadOS** | ❌ non da qui | — | un Mac, Xcode e un account sviluppatore Apple |

---

## Desktop — Tauri

La configurazione è in `src-tauri/`. Tauri usa la webview già presente nel
sistema operativo invece di imbarcare un browser intero, ed è la ragione per cui
il binario pesa qualche megabyte invece di centocinquanta.

Per costruirlo servono Rust e, **solo su Linux**, le librerie di sistema della
webview (su Windows e macOS la webview è già nel sistema):

```bash
sudo apt-get install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
npx @tauri-apps/cli@2 build
```

In CI: avvia a mano il workflow **Pacchetti nativi** con `desktop` acceso. Escono
`.AppImage` e `.deb` per Linux, `.msi` per Windows, `.dmg` per macOS, come
artefatti della run.

**L'avviso di sicurezza.** Un binario non firmato fa comparire "editore
sconosciuto" su Windows e viene bloccato da Gatekeeper su macOS. Toglierlo non è
un problema di codice: è un certificato di firma (a pagamento, annuale) più, su
macOS, la notarizzazione presso Apple. Finché non ci sono, il pacchetto funziona
lo stesso — ma va detto a chi lo scarica, perché quell'avviso spaventa
giustamente.

## Android — Trusted Web Activity

`packaging/twa-manifest.json` configura Bubblewrap, che genera un progetto
Android il cui contenuto è la pagina pubblicata: nessuna barra del browser,
icona nel cassetto delle app, aggiornamenti che arrivano da soli perché il
contenuto è il sito.

Due cose devono essere vere perché funzioni:

1. **Il sito deve essere pubblicato e in HTTPS.** La TWA punta a
   `nikosnetsaj-design.github.io`, che è già così.
2. **La firma deve essere dichiarata dal sito.** Perché la barra del browser
   sparisca serve un file `/.well-known/assetlinks.json` che dichiari l'impronta
   della chiave con cui l'APK è firmato. Bubblewrap lo genera al primo build; va
   copiato in `public/.well-known/` e ripubblicato. Senza, l'app funziona ma
   mostra la barra dell'indirizzo, che è il modo in cui Android dice "non ho
   verificato che questi due siano la stessa persona".

La chiave di firma **non sta nel repository**: un APK firmato con una chiave
pubblica lo può rifare chiunque. Va creata una volta e messa nei segreti del
progetto:

```bash
keytool -genkey -v -keystore android.keystore -alias cinemate \
        -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 android.keystore   # il risultato va in ANDROID_KEYSTORE_B64
```

Segreti attesi dal workflow: `ANDROID_KEYSTORE_B64`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`.

**Conserva quel file.** Google Play lega per sempre un'applicazione alla sua
chiave: persa la chiave, non esiste più nessun modo di aggiornare quell'app.

## Fire TV — perché la TWA non basta

Una Trusted Web Activity ha bisogno di Chrome installato sul dispositivo, e Fire
OS non ce l'ha: il browser di Amazon è Silk. Un APK costruito così su Fire TV o
non parte o ricade in un browser dentro l'app, che è la cosa che la TWA doveva
evitare. La strada vera sarebbe un piccolo involucro WebView scritto apposta —
fattibile, ma è un secondo progetto Android da mantenere, non una riga di
configurazione, e non l'ho scritto.

Vale però la pena dire cosa c'è già: sul Fire TV il browser Silk apre CineMate
oggi, e da questa versione l'app si comanda col telecomando — le frecce spostano
il fuoco fra le copertine, il bordo di selezione è spesso, tutto è ingrandito per
la distanza (§3.11 di `PRODUCT.md`). Per l'uso quotidiano quella è già la
funzione; il pacchetto sarebbe soprattutto un'icona nella schermata iniziale.

## iOS e iPadOS — cosa manca

Non si può produrre qui, e non per una scelta: la catena di firma iOS gira solo
su macOS. Servono un Mac con Xcode, un account sviluppatore Apple (a
sottoscrizione annuale) e i profili di provisioning. In più, un involucro che sia
solo una WebView viene regolarmente rifiutato dalla revisione dell'App Store se
non aggiunge niente rispetto al sito.

Quello che funziona oggi, e funziona bene: Safari → Condividi → **Aggiungi alla
schermata Home**. Ne esce un'icona che apre l'app a schermo intero, senza barra
del browser, con i dati che restano sul dispositivo — cioè esattamente il
comportamento che avrebbe l'involucro nativo.

---

## Cosa non è stato verificato

Onestà sui limiti di questa consegna: **nessuno di questi pacchetti è stato
costruito**. L'ambiente in cui sono stati scritti non ha né le librerie della
webview per Linux né l'SDK Android, quindi la configurazione è corretta per come
è documentata ma la prima run del workflow è anche la sua prima prova vera. Se
qualcosa non torna, salta fuori lì — e il posto giusto dove aggiustarlo è
`.github/workflows/pacchetti.yml`.
