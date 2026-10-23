/* =========================================================
   hi — हिन्दी (Hindi) community-preview catalog.
   - MUST stay key-complete with en.ts (typed `Catalog`: a missing or
     extra key is a compile error).
   - Register: natural, concise UI Hindi; Devanagari throughout; Latin
     kept only for brand/tech words (RPG, XP, HUD, Ctrl+K, Kanban…).
   - Placeholders {name} / {count} / {percent} MUST be preserved verbatim.
   - Values are best-effort community previews, not vendor-localized copy.
   ========================================================= */

import type { Catalog } from "./en";

const hi: Catalog = {
  /* ---- Header ---- */
  "nav.newBoard": "नया बोर्ड",
  "nav.more": "और विकल्प",
  "nav.themes": "थीम और माहौल",
  "nav.settings": "सेटिंग्स",
  "nav.export": "एक्सपोर्ट / बैकअप",
  "nav.quickPaste": "क्विक पेस्ट टेक्स्ट",
  "nav.commandBar": "कमांड बार (Ctrl+K)",
  "nav.zen": "ज़ेन फ़ोकस HUD",
  "nav.reportCard": "रिपोर्ट कार्ड",
  "nav.rpg": "RPG प्रगति",
  "nav.toggleTheme": "लाइट / डार्क थीम बदलें",

  /* ---- Views ---- */
  "views.checklist": "चेकलिस्ट",
  "views.kanban": "कानबन",
  "views.matrix": "मैट्रिक्स",
  "views.graph": "माइंड मैप",
  "views.analytics": "एनालिटिक्स",
  "views.week": "इस सप्ताह",

  /* ---- Filters ---- */
  "filters.all": "सभी आइटम",
  "filters.active": "शेष",
  "filters.completed": "पूर्ण",
  "filters.priority": "★ प्राथमिकता",
  "filters.week": "इस सप्ताह",

  /* ---- Sidebar ---- */
  "side.pomodoro": "पोमोडोरो फ़ोकस",
  "side.focus": "फ़ोकस",
  "side.short5": "शॉर्ट 5 मि",
  "side.long15": "लॉन्ग 15 मि",
  "side.startFocus": "फ़ोकस शुरू करें",
  "side.resetTimer": "टाइमर रीसेट करें",
  "side.attachTask": "जुड़ा कार्य",
  "side.noTask": "-- कोई कार्य जुड़ा नहीं --",
  "side.boards": "मेरे गोल बोर्ड",
  "side.createBoard": "नया बोर्ड बनाएँ",
  "side.habits": "आदतें और स्ट्रीक",
  "side.newHabitPlaceholder": "नई आदत…",
  "side.daily": "दैनिक",
  "side.weekly": "साप्ताहिक",
  "side.addHabit": "आदत जोड़ें",
  "side.templates": "1-क्लिक टेम्पलेट",
  "side.load": "＋ लोड करें",
  "side.audioStudio": "ऑडियो-रिएक्टिव स्टूडियो",
  "side.gain": "गेन",
  "side.bass": "बेस",
  "side.mid": "मिड",
  "side.treble": "ट्रेबल",
  "side.chimes": "चाइम वॉइस पैक",

  /* ---- Common ---- */
  "common.done": "हो गया",
  "common.todo": "करना है",
  "common.doing": "प्रगति पर",
  "common.save": "सेव करें",
  "common.cancel": "रद्द करें",
  "common.delete": "हटाएँ",
  "common.close": "बंद करें",
  "common.add": "जोड़ें",
  "common.create": "बनाएँ",
  "common.edit": "संपादित करें",
  "common.progress": "प्रगति",
  "common.completed": "पूर्ण",
  "common.search": "कार्य, नोट्स, श्रेणियाँ खोजें…",
  "common.empty": "यहाँ अभी कुछ नहीं है",
  "common.tasks": "कार्य",
  "common.categories": "श्रेणियाँ",
  "common.notes": "नोट्स",
  "common.subtasks": "माइक्रो-स्टेप",

  /* ---- Settings ---- */
  "settings.title": "वर्कस्पेस मॉड्यूल और प्राथमिकताएँ",
  "settings.gamification": "RPG गेमिफिकेशन, XP और लेवल",
  "settings.heatmap": "365-दिन गतिविधि हीटमैप",
  "settings.autoParent": "सभी सबटास्क पूर्ण होने पर मुख्य कार्य स्वतः पूर्ण करें",
  "settings.reduceEffects": "इफ़ेक्ट घटाएँ (बैटरी सेवर)",
  "settings.followSystem": "थीम सिस्टम के अनुसार",
  "settings.language": "भाषा",
  "settings.fontScale": "फ़ॉन्ट आकार",
  "settings.edition": "एडिशन — {name}",
  "settings.switchToNormal": "{name} पर स्विच करें…",
  "settings.switchConfirm": "हाँ, {name} पर स्विच करें",
  "settings.dataDoctor": "डेटा डॉक्टर",
  "settings.runScan": "इंटीग्रिटी स्कैन चलाएँ",
  "settings.storage": "स्टोरेज और सिंक",
  "settings.lastBackup": "अंतिम बैकअप",

  /* ---- Habits ---- */
  "habits.streak": "{count}-अवधि की स्ट्रीक",
  "habits.freeze": "फ़्रीज़ करें",
  "habits.frozen": "फ़्रोज़न",
  "habits.mark": "चिह्नित करें",
  "habits.best": "सर्वश्रेष्ठ",
};

export default hi;
