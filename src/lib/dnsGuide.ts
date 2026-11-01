import { t } from "./i18n";
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
    note: t("dnsGuide.nessun_filtro_log_delle"),
  },
  {
    name: "Google Public DNS",
    ipv4: ["8.8.8.8", "8.8.4.4"],
    ipv6: ["2001:4860:4860::8888", "2001:4860:4860::8844"],
    doh: "https://dns.google/dns-query",
    dot: "dns.google",
    note: t("dnsGuide.nessun_filtro_il_piu"),
  },
  {
    name: "Quad9",
    ipv4: ["9.9.9.9", "149.112.112.112"],
    ipv6: ["2620:fe::fe", "2620:fe::9"],
    doh: "https://dns.quad9.net/dns-query",
    dot: "dns.quad9.net",
    note: t("dnsGuide.blocca_i_domini_associati"),
  },
  {
    name: "AdGuard DNS",
    ipv4: ["94.140.14.14", "94.140.15.15"],
    ipv6: ["2a10:50c0::ad1:ff", "2a10:50c0::ad2:ff"],
    doh: "https://dns.adguard-dns.com/dns-query",
    dot: "dns.adguard-dns.com",
    note: t("dnsGuide.blocca_pubblicita_e_tracker"),
  },
  {
    name: "OpenDNS",
    ipv4: ["208.67.222.222", "208.67.220.220"],
    ipv6: ["2620:119:35::35", "2620:119:53::53"],
    doh: "https://doh.opendns.com/dns-query",
    dot: "dns.opendns.com",
    note: t("dnsGuide.di_cisco_infrastruttura_stabile"),
  },
  {
    name: "CleanBrowsing",
    ipv4: ["185.228.168.9", "185.228.169.9"],
    ipv6: ["2a0d:2a00:1::2", "2a0d:2a00:2::2"],
    doh: "https://doh.cleanbrowsing.org/doh/security-filter/",
    dot: "security-filter-dns.cleanbrowsing.org",
    note: t("dnsGuide.tre_profili_distinti_sicurezza"),
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
    supports: t("dnsGuide.dot_di_sistema"),
    steps: [
      t("dnsGuide.impostazioni_rete_e_internet"),
      t("dnsGuide.nome_host_del_provider"),
      t("dnsGuide.scrivi_l_hostname_dot"),
      t("dnsGuide.vale_su_wi_fi"),
    ],
  },
  {
    name: "iOS e iPadOS 14 e successivi",
    supports: t("dnsGuide.doh_e_dot_tramite"),
    steps: [
      t("dnsGuide.ios_non_ha_un"),
      t("dnsGuide.cloudflare_e_adguard_pubblicano"),
      t("dnsGuide.impostazioni_generali_vpn_e"),
      t("dnsGuide.impostazioni_generali_vpn_e_2"),
    ],
  },
  {
    name: "Windows 11",
    supports: t("dnsGuide.doh_di_sistema"),
    steps: [
      t("dnsGuide.impostazioni_rete_e_internet_2"),
      t("dnsGuide.passa_da_automatico_a"),
      t("dnsGuide.scrivi_i_due_indirizzi"),
      t("dnsGuide.in_dns_su_https"),
    ],
  },
  {
    name: "macOS",
    supports: t("dnsGuide.doh_e_dot_tramite"),
    steps: [
      t("dnsGuide.in_chiaro_impostazioni_di"),
      t("dnsGuide.cifrato_serve_un_profilo"),
      t("dnsGuide.impostazioni_di_sistema_generali"),
    ],
  },
  {
    name: "Firefox",
    supports: t("dnsGuide.doh_solo_per_il"),
    steps: [
      t("dnsGuide.impostazioni_privacy_e_sicurezza"),
      t("dnsGuide.protezione_massima_usa_solo"),
      t("dnsGuide.personalizzato_accetta_l_url"),
      t("dnsGuide.attenzione_vale_solo_dentro"),
    ],
  },
  {
    name: t("dnsGuide.chrome_ed_edge"),
    supports: t("dnsGuide.doh_solo_per_il"),
    steps: [
      t("dnsGuide.impostazioni_privacy_e_sicurezza_2"),
      t("dnsGuide.scegli_un_fornitore_dall"),
      t("dnsGuide.come_firefox_e_il"),
    ],
  },
  {
    name: t("dnsGuide.il_router"),
    supports: t("dnsGuide.in_chiaro_per_tutta"),
    steps: [
      t("dnsGuide.e_l_unico_punto"),
      t("dnsGuide.pannello_del_router_wan"),
      t("dnsGuide.molti_router_degli_operatori"),
      t("dnsGuide.il_dns_cifrato_sul"),
    ],
  },
];

export interface FaqEntry {
  q: string;
  a: string;
}

export const DNS_FAQ: FaqEntry[] = [
  {
    q: t("dnsGuide.che_differenza_c_e"),
    a: t("dnsGuide.cifrano_la_stessa_cosa"),
  },
  {
    q: t("dnsGuide.se_cinemate_sa_gia"),
    a: t("dnsGuide.perche_sono_due_cose"),
  },
  {
    q: t("dnsGuide.cambiare_dns_mi_rende"),
    a: t("dnsGuide.no_e_la_distinzione"),
  },
  {
    q: t("dnsGuide.rallenta_la_navigazione"),
    a: t("dnsGuide.di_norma_no_e"),
  },
  {
    q: t("dnsGuide.serve_a_raggiungere_qualcosa"),
    a: t("dnsGuide.dipende_da_cosa_lo"),
  },
  {
    q: t("dnsGuide.come_verifico_che_sia"),
    a: t("dnsGuide.cloudflare_pubblica_1_1"),
  },
];
