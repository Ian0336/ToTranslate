export const SUPPORTED_LANGUAGES: Record<string, string> = {
  af: "Afrikaans", am: "Amharic", ar: "Arabic", az: "Azerbaijani",
  be: "Belarusian", bg: "Bulgarian", bn: "Bengali", ca: "Catalan",
  cs: "Czech", cy: "Welsh", da: "Danish", de: "German",
  el: "Greek", en: "English", es: "Spanish", et: "Estonian",
  fa: "Persian", fi: "Finnish", fr: "French", ga: "Irish",
  gl: "Galician", gu: "Gujarati", ha: "Hausa", hi: "Hindi",
  hr: "Croatian", hu: "Hungarian", hy: "Armenian", id: "Indonesian",
  is: "Icelandic", it: "Italian", ja: "Japanese", ka: "Georgian",
  kk: "Kazakh", km: "Khmer", kn: "Kannada", ko: "Korean",
  lt: "Lithuanian", lv: "Latvian", mk: "Macedonian", ml: "Malayalam",
  mn: "Mongolian", mr: "Marathi", ms: "Malay", mt: "Maltese",
  my: "Myanmar (Burmese)", ne: "Nepali", nl: "Dutch", no: "Norwegian",
  pa: "Punjabi", pl: "Polish", pt: "Portuguese", ro: "Romanian",
  ru: "Russian", sk: "Slovak", sl: "Slovenian", so: "Somali",
  sq: "Albanian", sr: "Serbian", sv: "Swedish", sw: "Swahili",
  ta: "Tamil", te: "Telugu", th: "Thai", tr: "Turkish",
  uk: "Ukrainian", ur: "Urdu", uz: "Uzbek", vi: "Vietnamese",
  zh: "Chinese", zu: "Zulu",
};

export const SORTED_LANGUAGES: Array<[string, string]> = Object.entries(
  SUPPORTED_LANGUAGES,
).sort((a, b) => a[1].localeCompare(b[1]));
