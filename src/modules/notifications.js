const db = require("../../database");
const { t } = require("./i18n");
const { buildRankUpBanner } = require("./keyboards");
let botRef = null;
function setBotRef(bot) { botRef = bot; }
async function notify(userId, eventType, data = {}) {
  if (!botRef) return;
  const user = db.getUser(userId);
  if (!user) return;
  const lang = user.language || "en";
  let msg = JSON.stringify(data);
  try { await botRef.api.sendMessage(userId, msg, { parse_mode: "Markdown" }); } catch {}
}
async function notifyAllUsers(message) {
  if (!botRef) return;
}
module.exports = { setBotRef, notify, notifyAllUsers };
