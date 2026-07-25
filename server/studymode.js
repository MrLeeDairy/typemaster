// Study-mode control: lets the in-app button cut the internet by driving the
// Windows Firewall scripts in ../tools. Each on/off spawns an ELEVATED
// PowerShell child (one UAC prompt), so the server itself need not run as
// admin. Unblocking is gated by the parent password (salted SHA-256 in
// %ProgramData%\Type2Memory\studymode.pass) verified here before elevation.
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TOOLS_DIR = path.join(__dirname, '..', 'tools');
const PASS_FILE = path.join(process.env.ProgramData || 'C:\\ProgramData', 'Type2Memory', 'studymode.pass');
const RULE_GLOB = 'Type2Memory-StudyMode-*';

function verifyPassword(pw) {
  if (!fs.existsSync(PASS_FILE)) return true; // no password set yet → allow
  const raw = fs.readFileSync(PASS_FILE, 'utf8').trim();
  const [salt, hash] = raw.split(':');
  if (!salt || !hash) return true;
  const h = crypto.createHash('sha256').update(salt + (pw || '')).digest('hex');
  return h === hash;
}

// Fire an elevated PowerShell running one of our .ps1 scripts. Fire-and-forget:
// the UAC prompt + rule change happen in the elevated child; callers confirm
// the result afterwards via isBlocked().
function runElevated(scriptFile) {
  const script = path.join(TOOLS_DIR, scriptFile);
  const inner = `Start-Process powershell -Verb RunAs -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${script}'`;
  const p = spawn('powershell.exe', ['-NoProfile', '-Command', inner], { windowsHide: true });
  p.on('error', () => {});
}

// Read current block state (no elevation needed to query firewall rules).
function isBlocked() {
  return new Promise(resolve => {
    const p = spawn('powershell.exe', ['-NoProfile', '-Command',
      `@(Get-NetFirewallRule -DisplayName '${RULE_GLOB}' -ErrorAction SilentlyContinue).Count`],
      { windowsHide: true });
    let out = '';
    p.stdout.on('data', d => out += d);
    p.on('close', () => resolve(parseInt(out.trim(), 10) > 0));
    p.on('error', () => resolve(false));
  });
}

function register(app) {
  app.post('/api/studymode/on', (req, res) => {
    runElevated('fw-block.ps1');
    res.json({ ok: true });
  });

  app.post('/api/studymode/off', (req, res) => {
    if (!verifyPassword(req.body && req.body.password)) {
      return res.status(403).json({ error: 'bad password' });
    }
    runElevated('fw-unblock.ps1');
    res.json({ ok: true });
  });

  app.get('/api/studymode/status', async (req, res) => {
    res.json({ blocked: await isBlocked() });
  });
}

module.exports = { register };
