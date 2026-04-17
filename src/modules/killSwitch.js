// M48 — Kill Switch
const db = require("../../database");

function isActive() {
  return db.getSysConfig("kill_switch_active") === "1";
}
function activate() {
  db.setSysConfig("kill_switch_active", "1");
}
function deactivate() {
  db.setSysConfig("kill_switch_active", "0");
}

module.exports = { isActive, activate, deactivate };
