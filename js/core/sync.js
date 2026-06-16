// sync.js — pure last-write-wins merge for single-user multi-device sync.
// updated_at is an ISO-8601 string, so lexical comparison == chronological.

const ts = (w) => w?.updated_at || '1970-01-01T00:00:00.000Z';

/**
 * Merge local and remote workout lists by updated_at (newer wins).
 * @returns {{merged: object[], toUpsertRemote: object[]}}
 *   merged          — the reconciled set to store locally
 *   toUpsertRemote  — rows that are local-only or locally-newer (must be pushed)
 */
export function mergeByUpdatedAt(localList = [], remoteList = []) {
  const byId = new Map();
  for (const r of remoteList) byId.set(r.id, { remote: r });
  for (const l of localList) byId.set(l.id, { ...(byId.get(l.id) || {}), local: l });

  const merged = [];
  const toUpsertRemote = [];

  for (const { local, remote } of byId.values()) {
    if (local && remote) {
      if (ts(local) > ts(remote)) {
        merged.push(local);
        toUpsertRemote.push(local);
      } else {
        merged.push(remote);
      }
    } else if (local) {
      merged.push(local);
      toUpsertRemote.push(local); // local-only -> upload
    } else {
      merged.push(remote);
    }
  }

  return { merged, toUpsertRemote };
}

/** Apply a single incoming remote change (e.g. realtime) to a local list, LWW. */
export function applyRemoteChange(localList, remoteRow) {
  const out = localList.slice();
  const i = out.findIndex((w) => w.id === remoteRow.id);
  if (i < 0) { out.push(remoteRow); return out; }
  if (ts(remoteRow) >= ts(out[i])) out[i] = remoteRow;
  return out;
}
