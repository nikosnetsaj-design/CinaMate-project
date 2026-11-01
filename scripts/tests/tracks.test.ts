// Le tracce ricordate per titolo (per una serie, per tutta la serie).
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
};
(globalThis as any).window = { dispatchEvent: () => true };

const { getTitleTracks, rememberTitleTracks } = await import("../../src/player/services/titleTracks.ts");
const { getPlaybackPrefs, setPlaybackPrefs } = await import("../../src/player/services/playbackPrefs.ts");

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

setPlaybackPrefs({ audioLang: "it", subtitleLang: null });
rememberTitleTracks("anime", { audioLang: "ja", subtitleLang: "it" });
rememberTitleTracks("anime", { syncOffsetMs: 400 });
const anime = getTitleTracks("anime");
check("per titolo: le scelte si sommano", anime.audioLang === "ja" && anime.subtitleLang === "it" && anime.syncOffsetMs === 400, JSON.stringify(anime));
check("un titolo mai toccato non ha niente di suo", JSON.stringify(getTitleTracks("altra")) === JSON.stringify({ subtitleLang: undefined, audioLang: undefined, syncOffsetMs: undefined }));
check("la preferenza generale resta per gli altri", getPlaybackPrefs().audioLang === "it");

const wanted = (id: string) => getTitleTracks(id).audioLang ?? getPlaybackPrefs().audioLang;
check("vince il titolo, poi la generale", wanted("anime") === "ja" && wanted("altra") === "it");

rememberTitleTracks("doc", { subtitleLang: null });
check("spenti per scelta resta un null, non un «mai scelto»", getTitleTracks("doc").subtitleLang === null);

mem.set("ppv:title-tracks", JSON.stringify({ x: { syncOffsetMs: 99999, audioLang: 3 } }));
check("valori sporchi ripuliti", getTitleTracks("x").syncOffsetMs === 30000 && getTitleTracks("x").audioLang === undefined);
mem.set("ppv:title-tracks", "{rotto");
check("un archivio rotto non rompe il lettore", JSON.stringify(getTitleTracks("anime")) === JSON.stringify({ subtitleLang: undefined, audioLang: undefined, syncOffsetMs: undefined }));
check("senza titolo non si ricorda niente", (rememberTitleTracks(undefined, { audioLang: "en" }), mem.get("ppv:title-tracks") === "{rotto"));

for (let i = 0; i < 230; i++) rememberTitleTracks(`t${i}`, { audioLang: "en" });
const stored = JSON.parse(mem.get("ppv:title-tracks") ?? "{}");
check("memoria con un tetto, i più recenti restano", Object.keys(stored).length === 200 && "t229" in stored && !("t0" in stored));

console.log(failures === 0 ? "\nTutti i controlli passati." : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
