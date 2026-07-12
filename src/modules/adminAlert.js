// Admin-only error alerting - notifies admin when a critical external API fails,
// with the source name, debounced so the same error doesn't spam repeatedly.
const db = require("../../database");
const config = require("../../config");

let botApiRef = null;
function setAlertBotApi(api) { botApiRef = api; }

const DEBOUNCE_MS = 10 * 60 * 1000; // max one alert per source every 10 minutes

async function alertAdmin(source, message) {
  try {
    const key = `admin_alert_${source}`;
    const last = parseInt(db.getSysConfig(key) || "0");
    if (Date.now() - last < DEBOUNCE_MS) return; // debounced, skip
    db.setSysConfig(key, String(Date.now()));

    const adminId = config.ADMIN_IDS[0];
    if (!adminId || !botApiRef) return;
    await botApiRef.sendMessage(adminId, `⚠️ *[${source}]*\n\n${message}`, { parse_mode: "Markdown" });
  } catch (e) {
    console.log("[AdminAlert] failed to send:", e.message);
  }
}

module.exports = { alertAdmin, setAlertBotApi };
