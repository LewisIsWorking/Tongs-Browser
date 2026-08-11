/**
 * Wait for the phone's DevTools socket, then run a command. Added 2026-08-11.
 *
 * Chrome on Android only serves its debugging socket while the browser is in the FOREGROUND. That
 * turns every device run into a coordination problem: the user has to be looking at Foundry at the
 * exact moment the check starts, and they cannot be, because the way they report a result is by
 * switching to another app to paste it. Four runs died to that, each looking like a different fault.
 *
 * So the check waits instead of demanding a rendezvous. The user opens the browser whenever they
 * like, and this notices and starts. It re-establishes the adb forward on every attempt, because the
 * forward survives the socket going away and is then pointed at nothing.
 *
 *   node scripts/await-device-then.ts -- node scripts/foundry-drag-check.ts --android
 */
import { spawn, spawnSync } from 'node:child_process';

const ENDPOINT = process.env['CDP_ENDPOINT'] ?? 'http://127.0.0.1:9222';
const POLL_MS = 3000;
const GIVE_UP_MS = Number(process.env['AWAIT_DEVICE_TIMEOUT_MS'] ?? 900_000);

const separator = process.argv.indexOf('--');
const command = separator === -1 ? [] : process.argv.slice(separator + 1);
if (command.length === 0) {
  console.error('nothing to run. Usage: node await-device-then.ts -- <command> [args...]');
  process.exit(1);
}

/**
 * Re-forward every time rather than once at the start.
 *
 * `adb forward` happily reports success while the far end is gone, so a forward established before
 * the browser was foregrounded stays "up" and refuses connections. Re-establishing costs nothing and
 * removes a failure that presents as an unexplained ECONNREFUSED.
 */
function refreshForward(): void {
  spawnSync('adb', ['forward', '--remove-all'], { stdio: 'ignore' });
  spawnSync('adb', ['forward', 'tcp:9222', 'localabstract:chrome_devtools_remote'], {
    stdio: 'ignore',
  });
}

async function socketIsUp(): Promise<boolean> {
  try {
    const response = await fetch(`${ENDPOINT}/json/version`, {
      signal: AbortSignal.timeout(4000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

const startedAt = Date.now();
console.log(`Waiting for the phone's DevTools socket on ${ENDPOINT}.`);
console.log('Open the browser on the phone with Foundry showing; this will start on its own.');

while (Date.now() - startedAt < GIVE_UP_MS) {
  refreshForward();
  if (await socketIsUp()) {
    console.log(`Socket is up after ${String(Math.round((Date.now() - startedAt) / 1000))}s.`);
    const [executable, ...args] = command;
    if (executable === undefined) {
      break;
    }
    const child = spawn(executable, args, { stdio: 'inherit', shell: false });
    child.on('exit', (code: number | null) => process.exit(code ?? 0));
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, POLL_MS));
}

if (Date.now() - startedAt >= GIVE_UP_MS) {
  console.error(
    `the socket never came up within ${String(Math.round(GIVE_UP_MS / 1000))}s. ` +
      `Check wireless debugging is still paired and the browser is in the foreground.`
  );
  process.exit(1);
}
