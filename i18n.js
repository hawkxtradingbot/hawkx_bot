// M10 — i18n Language Module
const path = require("path");
const locales = {};

["en", "ar", "zh", "ru"].forEach((lang) => {
  try {
    locales[lang] = require(
      path.join(__dirname, "../../locales", `${lang}.json`),
    );
  } catch {
    locales[lang] = {};
  }
});

function t(key, lang = "en", vars = {}) {
  const locale = locales[lang] || locales["en"];
  let str = locale[key] || locales["en"][key] || key;
  return str.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] !== undefined ? vars[k] : `{${k}}`,
  );
}

module.exports = { t };
