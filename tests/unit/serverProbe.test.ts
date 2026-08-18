import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  findNeighbourServers,
  findStaleLock,
  neighbourPorts,
} from '../../scripts/foundry/serverProbe.ts';

/**
 * Gathering the facts, against a real filesystem rather than a mock of one.
 *
 * ⚠️ A real temp directory on purpose. The thing being tested is "does this path exist", which is
 * precisely the question a mocked fs answers by fiat - a stubbed existsSync would pass against a
 * path built wrong, and the path is the part that has to be right. Foundry locks
 * `<dataPath>/Config/options.json.lock`, measured on 14.366.
 */
let dataPath: string;

beforeAll(() => {
  dataPath = mkdtempSync(join(tmpdir(), 'tongs-lock-'));
});

afterAll(() => {
  rmSync(dataPath, { recursive: true, force: true });
});

describe('finding a stale lock', () => {
  it('reports absent when the data directory has no lock', () => {
    const found = findStaleLock(dataPath);

    expect(found.kind).toBe('absent');
  });

  /** ⚠️ A DIRECTORY, not a file. Foundry acquires the lock with an atomic mkdir. */
  it('reports held, with the path, once the lock directory exists', () => {
    mkdirSync(join(dataPath, 'Config', 'options.json.lock'), { recursive: true });

    const found = findStaleLock(dataPath);

    expect(found.kind).toBe('held');
    expect(found.kind === 'held' && found.path).toContain('options.json.lock');
  });

  it('reports unchecked, saying why, when there is no data path to look in', () => {
    const found = findStaleLock(null);

    expect(found.kind).toBe('unchecked');
    expect(found.kind === 'unchecked' && found.why).toContain('FOUNDRY_DATA_PATH');
  });
});

/**
 * ⚠️ Derived, not scanned. A port scan would be slow, would knock on things that are not Foundry,
 * and would make the message longer without making it truer.
 */
describe('choosing ports to try', () => {
  it('tries next door and Foundry default, never the port that just failed', () => {
    expect(neighbourPorts('http://localhost:30000')).toEqual([30001, 30002]);
  });

  it('includes the Foundry default when the failed port is something else', () => {
    expect(neighbourPorts('http://localhost:8080')).toEqual([8081, 8082, 30000]);
  });

  it('does not suggest the same port twice', () => {
    const ports = neighbourPorts('http://localhost:29999');

    expect(ports).toEqual([...new Set(ports)]);
    expect(ports).toContain(30000);
  });

  it('assumes Foundry default when the address carries no port', () => {
    expect(neighbourPorts('http://localhost')).toEqual([30001, 30002]);
  });

  it('yields nothing for an address it cannot parse, rather than throwing', () => {
    expect(neighbourPorts('not a url')).toEqual([]);
  });
});

/**
 * ⚠️ Silence must be the empty result, not an error. This code only ever runs while already
 * reporting a failure, and a diagnostic that throws mid-diagnosis leaves no message at all.
 *
 * ⚠️ THE PORTS ARE PASSED IN, and this test is why. `neighbourPorts` always includes Foundry's
 * default 30000, so the default-argument version of this test passed only while no Foundry was
 * running and failed the instant one started on 2026-08-18. It was measuring the machine, not the
 * code. Naming a closed set makes the assertion true regardless of what is up.
 */
describe('probing neighbours', () => {
  it('reports nothing when nothing is listening on the ports it is given', async () => {
    // Ports in the 1-3 range need privileges and are reliably not Foundry.
    expect(await findNeighbourServers('http://127.0.0.1:1', [2, 3])).toEqual([]);
  });

  it('reports nothing when given no ports at all', async () => {
    expect(await findNeighbourServers('http://127.0.0.1:1', [])).toEqual([]);
  });

  it('returns empty for an unparseable address instead of throwing', async () => {
    await expect(findNeighbourServers('not a url', [30000])).resolves.toEqual([]);
  });
});
