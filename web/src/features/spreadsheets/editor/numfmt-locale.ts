// The locales the number formats of the editor know (INumfmtLocaleTag of Univer 1.6.0).
const known = new Set(
  (
    "zh_CN,zh_TW,zh_HK,ja,ko,th,cs,da,nl,en,en_AU,en_CA,en_GB,en_IE,fi,fr,fr_CA,fr_CH,de,de_CH," +
    "el,hu,is,id,it,it_CH,nb,no,pl,pt,pt_BR,ru,sk,es,es_AR,es_BO,es_CL,es_CO,es_EC,es_MX,es_PY," +
    "es_UY,es_VE,sv,tr,cy,az,be,bg,ca,fil,gu,he,hr,hy,ka,kk,kn,lt,lv,ml,mn,mr,my,pa,ro,sl,sr,ta," +
    "te,uk,vi,ar,bn,hi"
  ).split(","),
);

// The locale by which the editor reads a typed number or date and writes a formatted one, for
// the tag of the application ("pt-BR", "en-US", "de-CH"). A tag the editor does not know falls
// to its language, and an unknown language to "en": "1,5" is a number under "pt-BR" and a text
// under "en".
export function numfmtLocale(tag: string): string {
  const [language = "", region] = tag.split("-");
  const full = region === undefined ? language : `${language}_${region}`;

  if (known.has(full)) return full;
  if (known.has(language)) return language;

  return "en";
}
