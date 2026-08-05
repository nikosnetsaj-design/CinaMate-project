/**
 * Riferimento sul DNS cifrato: DoH (DNS over HTTPS) e DoT (DNS over TLS).
 *
 * Cosa c'è qui e cosa no. Qui ci sono gli indirizzi *pubblici* dei resolver
 * pubblici — quelli che Cloudflare e Google documentano sui propri siti — e le
 * istruzioni per impostarli, che sono le stesse in ogni guida sulla privacy
 * DNS scritta negli ultimi dieci anni. Sono dati di configurazione di rete, e
 * la ragione normale per cambiarli è quella per cui esistono: le richieste DNS
 * in chiaro le legge chiunque sia sul percorso, il resolver dell'operatore
 * spesso è lento, e la risoluzione è il punto in cui una rete pubblica può
 * mandarti dove vuole lei.
 *
 * Quello che non c'è, e non ci sarà: un elenco di siti, un consiglio su quali
 * raggiungere e la pretesa che cambiare resolver cambi cosa è lecito guardare.
 * Un DNS diverso risolve nomi diversamente; non ti dà diritti che non hai, e i
 * blocchi che contano davvero (a livello di IP, di rotta, di piattaforma) non
 * passano dal DNS.
 */

export interface Resolver {
  name: string;
  /** IPv4, come si scrivono nelle impostazioni di rete. */
  ipv4: [string, string];
  ipv6?: [string, string];
  /** Endpoint DNS over HTTPS — porta TCP 443. */
  doh: string;
  /** Hostname DNS over TLS — porta TCP 853. */
  dot: string;
  note: string;
}

/**
 * La differenza fra i due protocolli in una riga, perché è la sola cosa che
 * conta davvero nello scegliere.
 */
export const PORTS = { doh: 443, dot: 853 } as const;

/**
 * I due che l'utente chiede per nome, più due che vale la pena conoscere:
 * Quad9 filtra i domini noti per malware, AdGuard filtra i tracker. Sono
 * differenze di *politica*, non di velocità, e la tabella lo dice invece di
 * presentarli come quattro cose uguali.
 */
export const RESOLVERS: Resolver[] = [
  {
    name: "Cloudflare",
    ipv4: ["1.1.1.1", "1.0.0.1"],
    ipv6: ["2606:4700:4700::1111", "2606:4700:4700::1001"],
    doh: "https://cloudflare-dns.com/dns-query",
    dot: "one.one.one.one",
    note: "Nessun filtro. Log delle query cancellati entro 24 ore, per policy dichiarata e sottoposta ad audit.",
  },
  {
    name: "Google Public DNS",
    ipv4: ["8.8.8.8", "8.8.4.4"],
    ipv6: ["2001:4860:4860::8888", "2001:4860:4860::8844"],
    doh: "https://dns.google/dns-query",
    dot: "dns.google",
    note: "Nessun filtro. Il più vecchio dei resolver pubblici, e quello con più presenza geografica.",
  },
  {
    name: "Quad9",
    ipv4: ["9.9.9.9", "149.112.112.112"],
    ipv6: ["2620:fe::fe", "2620:fe::9"],
    doh: "https://dns.quad9.net/dns-query",
    dot: "dns.quad9.net",
    note: "Blocca i domini associati a malware e phishing, su liste di threat intelligence. Fondazione svizzera senza scopo di lucro.",
  },
  {
    name: "AdGuard DNS",
    ipv4: ["94.140.14.14", "94.140.15.15"],
    ipv6: ["2a10:50c0::ad1:ff", "2a10:50c0::ad2:ff"],
    doh: "https://dns.adguard-dns.com/dns-query",
    dot: "dns.adguard-dns.com",
    note: "Blocca pubblicità e tracker a livello di nome. È un ad-block che vale per tutto il dispositivo, app comprese.",
  },
  {
    name: "OpenDNS",
    ipv4: ["208.67.222.222", "208.67.220.220"],
    ipv6: ["2620:119:35::35", "2620:119:53::53"],
    doh: "https://doh.opendns.com/dns-query",
    dot: "dns.opendns.com",
    note: "Di Cisco. Infrastruttura stabile e filtri di sicurezza opzionali, configurabili da un account.",
  },
  {
    name: "CleanBrowsing",
    ipv4: ["185.228.168.9", "185.228.169.9"],
    ipv6: ["2a0d:2a00:1::2", "2a0d:2a00:2::2"],
    doh: "https://doh.cleanbrowsing.org/doh/security-filter/",
    dot: "security-filter-dns.cleanbrowsing.org",
    note: "Tre profili distinti — sicurezza, famiglia, adulti — e quello elencato qui è il profilo sicurezza.",
  },
];

export interface Platform {
  name: string;
  /** DoH o DoT nativi, senza installare niente. */
  supports: string;
  steps: string[];
}

export const PLATFORM_STEPS: Platform[] = [
  {
    name: "Android 9 e successivi",
    supports: "DoT, di sistema",
    steps: [
      "Impostazioni → Rete e Internet → DNS privato",
      "«Nome host del provider DNS privato»",
      "Scrivi l'hostname DoT della colonna corrispondente (per esempio one.one.one.one)",
      "Vale su Wi-Fi e su rete mobile insieme, per tutte le app",
    ],
  },
  {
    name: "iOS e iPadOS 14 e successivi",
    supports: "DoH e DoT, tramite profilo",
    steps: [
      "iOS non ha un campo nelle impostazioni: serve un profilo di configurazione DNS",
      "Cloudflare e AdGuard pubblicano la propria app ufficiale, che installa il profilo",
      "Impostazioni → Generali → VPN e gestione dispositivo per vedere e rimuovere il profilo",
      "Impostazioni → Generali → VPN e gestione dispositivo → DNS per scegliere quale è attivo",
    ],
  },
  {
    name: "Windows 11",
    supports: "DoH, di sistema",
    steps: [
      "Impostazioni → Rete e Internet → scheda in uso → Modifica assegnazione server DNS",
      "Passa da Automatico a Manuale, attiva IPv4",
      "Scrivi i due indirizzi IPv4 del resolver",
      "In «DNS su HTTPS» scegli «Attivo (modello automatico)»: Windows riconosce i resolver noti dall'IP",
    ],
  },
  {
    name: "macOS",
    supports: "DoH e DoT, tramite profilo",
    steps: [
      "In chiaro: Impostazioni di Sistema → Rete → Dettagli → DNS, e aggiungi gli IPv4",
      "Cifrato: serve un profilo `.mobileconfig`, che i resolver pubblicano sui propri siti",
      "Impostazioni di Sistema → Generali → VPN e gestione dispositivo per verificarlo o rimuoverlo",
    ],
  },
  {
    name: "Firefox",
    supports: "DoH, solo per il browser",
    steps: [
      "Impostazioni → Privacy e sicurezza → in fondo, «DNS su HTTPS»",
      "«Protezione massima» usa solo DoH e non ripiega sul DNS di sistema",
      "«Personalizzato» accetta l'URL della colonna DoH",
      "Attenzione: vale solo dentro Firefox. Il resto del dispositivo continua col DNS di sistema",
    ],
  },
  {
    name: "Chrome ed Edge",
    supports: "DoH, solo per il browser",
    steps: [
      "Impostazioni → Privacy e sicurezza → Sicurezza → «Usa DNS sicuro»",
      "Scegli un fornitore dall'elenco, o incolla l'URL della colonna DoH",
      "Come Firefox: è il browser, non il dispositivo",
    ],
  },
  {
    name: "Il router",
    supports: "In chiaro per tutta la rete; DoH/DoT dipende dal modello",
    steps: [
      "È l'unico punto in cui la modifica vale per ogni dispositivo di casa, TV e console comprese",
      "Pannello del router → WAN o LAN → server DNS, e scrivi i due IPv4",
      "Molti router degli operatori non permettono di cambiarli: in quel caso resta la modifica per dispositivo",
      "Il DNS cifrato sul router richiede firmware che lo supporti (OpenWRT, pfSense, alcuni AVM e ASUS)",
    ],
  },
];

export interface FaqEntry {
  q: string;
  a: string;
}

export const DNS_FAQ: FaqEntry[] = [
  {
    q: "Che differenza c'è fra DoH e DoT?",
    a: "Cifrano la stessa cosa in due modi. DoT usa una porta sua, la 853: è pulito da amministrare e facile da distinguere sulla rete, quindi anche facile da bloccare. DoH viaggia sulla 443 insieme a tutto il traffico HTTPS: è indistinguibile dal resto, e per questo è quello che i browser hanno adottato. Sul piano della riservatezza sono equivalenti.",
  },
  {
    q: "Se CineMate sa già interrogare il DoH, perché devo configurare qualcosa?",
    a: "Perché sono due cose diverse. La casella qui sotto interroga un resolver pubblico e ti dice cosa risponde: è una diagnosi, e serve a distinguere «il sito è spento» da «il nome non si traduce». Non cambia come il browser risolve i nomi quando apre una pagina — quella decisione è del sistema operativo, o del browser se ha il DoH acceso nelle sue impostazioni. Nessuna pagina web può dirottare la propria risoluzione dei nomi, e sarebbe grave se potesse.",
  },
  {
    q: "Cambiare DNS mi rende anonimo?",
    a: "No, e la distinzione è netta. Sposta soltanto chi vede le tue richieste di risoluzione: dal resolver dell'operatore a quello che scegli tu. Il tuo indirizzo IP resta il tuo, i siti che apri continuano a vederlo, e il tuo operatore continua a vedere verso quali IP ti colleghi — anche col DNS cifrato, perché l'instradamento è un altro strato.",
  },
  {
    q: "Rallenta la navigazione?",
    a: "Di norma no, e spesso è il contrario: i resolver pubblici hanno più presenza geografica e cache più calde di quelli di molti operatori. Il costo è la stretta di mano TLS della prima richiesta, che si paga una volta per connessione.",
  },
  {
    q: "Serve a raggiungere qualcosa che non raggiungo?",
    a: "Dipende da cosa lo impedisce, ed è utile essere precisi. Se un nome non si risolve, un resolver diverso può risolverlo. Se il blocco è sull'indirizzo IP, sull'instradamento o applicato dal servizio stesso, il DNS non c'entra e cambiarlo non cambia niente. In ogni caso non cambia cosa è lecito guardare: quello dipende da chi ha i diritti su ciò che stai aprendo, non da chi ti risolve i nomi.",
  },
  {
    q: "Come verifico che sia attivo davvero?",
    a: "Cloudflare pubblica 1.1.1.1/help, che dice quale resolver stai usando e se la connessione è cifrata. Google ha dns.google. Se la pagina mostra ancora il resolver dell'operatore, l'impostazione non è quella attiva — succede spesso quando si è cambiato il browser ma non il sistema, o viceversa.",
  },
];
