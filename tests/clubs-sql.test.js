// Clubs on the server (0026_clubs.sql): create, invite, the size cap, leaving,
// the weekly total and the relay count only verified work, and a club board
// that holds totals, never anyone's days. Runs every migration in PGlite
// (skips when it isn't installed).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generatedBlock, BEGIN, END, MIGRATION } from '../tools/clubs-sql.mjs';
import { CLUB_RULES, RELAY_ROUTES } from '../js/core/clubs.js';

test('the generated block in 0026_clubs.sql matches js/core', () => {
  const sql = readFileSync(MIGRATION, 'utf8');
  assert.equal(sql.slice(sql.indexOf(BEGIN), sql.indexOf(END) + END.length), generatedBlock(), 'run: node tools/clubs-sql.mjs');
});

let PGlite = null;
try { ({ PGlite } = await import('@electric-sql/pglite')); } catch { /* not installed */ }
const skip = !PGlite && 'PGlite not installed';

const uid = (n) => `00000000-0000-0000-0000-0000000001${String(n).padStart(2, '0')}`;

async function freshDb(users = 3) {
  const db = new PGlite();
  await db.exec(`
    create role authenticated; create role anon; create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
    create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create or replace function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
    create publication supabase_realtime;
  `);
  const dir = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(dir + f, 'utf8'));
  for (let i = 1; i <= users; i++) {
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [uid(i), `u${i}@test`, { display_name: `Athlete ${i}` }]);
    await db.query(`update public.profiles set username = $2, display_name = $3 where id = $1`, [uid(i), `athlete${i}`, `Athlete ${i}`]);
  }
  return db;
}
const as = (db, n) => db.query(`select set_config('test.uid', $1, false)`, [uid(n)]);
const code = (p) => p.then(() => 'ok', (e) => String(e.message).replace(/^.*club:/, ''));
const one = async (db, sql, args = []) => (await db.query(sql, args)).rows[0];

test('create, invite, accept, leave: one club at a time, names unique, the owner hands over', { skip }, async () => {
  const db = await freshDb(3);
  await as(db, 1);
  assert.equal(await code(db.query(`select public.create_club('ab', 'wave')`)), 'name_short');
  assert.equal(await code(db.query(`select public.create_club('Los Alisios', 'dragon')`)), 'crest');
  const { create_club: cid } = await one(db, `select public.create_club('  Los   Alisios ', 'wave')`);
  assert.ok(cid);
  assert.equal((await one(db, 'select name from public.clubs where id = $1', [cid])).name, 'Los Alisios');
  assert.equal(await code(db.query(`select public.create_club('Another', 'sun')`)), 'already_in');
  // the first relay starts with the club
  assert.equal((await one(db, 'select route_id from public.club_relays where club_id = $1', [cid])).route_id, RELAY_ROUTES[0].id);
  // invites by username land in the invitee's notifications
  assert.equal(await code(db.query(`select public.invite_to_club('nobody')`)), 'no_user');
  assert.equal(await code(db.query(`select public.invite_to_club('@athlete2')`)), 'ok');
  await as(db, 2);
  assert.equal(await code(db.query(`select public.create_club('los alisios', 'sun')`)), 'name_taken');
  const inv = (await db.query('select * from public.my_club_invites()')).rows;
  assert.equal(inv.length, 1);
  assert.equal(inv[0].name, 'Los Alisios');
  const note = await one(db, `select kind, data from public.notifications where user_id = $1`, [uid(2)]);
  assert.equal(note.kind, 'club_invite');
  assert.equal(Number(note.data.invite_id), Number(inv[0].id));
  assert.equal(await code(db.query('select public.respond_club_invite($1, true)', [inv[0].id])), 'ok');
  assert.equal((await one(db, 'select public.my_club_id() as c')).c, cid);
  // leaving is free; when the owner leaves, the longest-standing member takes over
  await as(db, 1);
  await db.query('select public.leave_club()');
  assert.equal((await one(db, 'select public.my_club_id() as c')).c, null);
  assert.equal((await one(db, `select role from public.club_members where user_id = $1 and left_at is null`, [uid(2)])).role, 'owner');
});

test('the size cap holds on accept', { skip }, async () => {
  const n = CLUB_RULES.maxMembers + 1;
  const db = await freshDb(n);
  await as(db, 1);
  await db.query(`select public.create_club('Full House', 'sun')`);
  for (let i = 2; i <= n; i++) {
    await as(db, 1);
    const r = await code(db.query(`select public.invite_to_club($1)`, [`athlete${i}`]));
    if (i <= CLUB_RULES.maxMembers) {
      assert.equal(r, 'ok');
      await as(db, i);
      const inv = (await db.query('select id from public.my_club_invites()')).rows[0];
      assert.equal(await code(db.query('select public.respond_club_invite($1, true)', [inv.id])), 'ok');
    } else {
      assert.equal(r, 'full');
    }
  }
  assert.equal((await one(db, 'select count(*)::int as n from public.club_members where left_at is null')).n, CLUB_RULES.maxMembers);
});

test('the board counts verified work only and holds totals, not anyone\'s days', { skip }, async () => {
  const db = await freshDb(2);
  await as(db, 1);
  await db.query(`select public.create_club('Calima Crew', 'bolt')`);
  await db.query(`select public.invite_to_club('athlete2')`);
  await as(db, 2);
  const inv = (await db.query('select id from public.my_club_invites()')).rows[0];
  await db.query('select public.respond_club_invite($1, true)', [inv.id]);
  const today = new Date().toISOString().slice(0, 10);
  const put = (n, id, type, min, km, proof) => db.query(`insert into public.workouts (id, user_id, date, type, intensity, duration_min, distance_km, completed, completed_at, strava_activity_id, source)
    values ($1, $2, $3, $4, 'moderate', $5, $6, true, now(), $7, 'plan')`, [id, uid(n), today, type, min, km, proof]);
  await put(1, 'a', 'bike', 120, 60, 1);
  await put(2, 'b', 'run', 45, 9.5, 2);
  await put(2, 'c', 'run', 300, 80, null); // no proof: doesn't count
  await put(1, 'd', 'gym', 60, null, 3);
  const b = (await one(db, 'select public.club_board() as b')).b;
  assert.equal(b.week_minutes, 120 + 45 + 60);
  assert.equal(Number(b.relay.km), 69.5);
  assert.equal(b.members.length, 2);
  // nothing per member beyond a name: no minutes, no days
  for (const m of b.members) assert.deepEqual(Object.keys(m).sort(), ['avatar', 'display_name', 'role', 'user_id', 'username']);
  // the target: anyone in the club may set it, in hours, inside the bounds
  assert.equal(await code(db.query('select public.set_club_target(0)')), 'target');
  assert.equal(await code(db.query('select public.set_club_target(8)')), 'ok');
  assert.equal((await one(db, 'select public.club_board() as b')).b.target_minutes, 480);
  // the next relay waits for this one to finish
  assert.equal(await code(db.query('select public.start_relay()')), 'relay_running');
  // someone outside sees no board
  await as(db, 3);
  assert.equal((await one(db, 'select public.club_board() as b')).b, null);
});

test('clubs list by name for anyone signed in', { skip }, async () => {
  const db = await freshDb(2);
  await as(db, 1);
  await db.query(`select public.create_club('Mar de Nubes', 'peak')`);
  await as(db, 2);
  const all = (await db.query(`select * from public.list_clubs('')`)).rows;
  assert.equal(all.length, 1);
  assert.equal(all[0].members, 1);
  assert.equal((await db.query(`select * from public.list_clubs('nubes')`)).rows.length, 1);
  assert.equal((await db.query(`select * from public.list_clubs('%')`)).rows.length, 1);
  assert.equal((await db.query(`select * from public.list_clubs('zzz')`)).rows.length, 0);
});
