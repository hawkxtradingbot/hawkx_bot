const db = require("../../database");

function isActive() {
  return db.getSysConfig("kill_switch_active") === "1";
}

function activate() {
  db.setSysConfig("kill_switch_active", "1");
  console.log("[KillSwitch] 🔴 ACTIVATED — all trading paused");
}

function deactivate() {
  db.setSysConfig("kill_switch_active", "0");
  console.log("[KillSwitch] ✅ Deactivated — trading resumed");
}

module.exports = { isActive, activate, deactivate };
