// gym-split.js — the weekly split for the AI questionnaire, and turning AI
// gym sessions into real exercises. Pure; no DOM.
//
// A split: { preset, days: [{ label, groups: ['Chest', ...], rest? }] }, one
// entry per day of the training week in order. Warnings are advice for the
// athlete to read, never a block on generating the plan.
//
// AI sessions (old and new) carry their movements in the notes, e.g.
//   "[Warmup] ... [Main Set] Back Squat 4x8 @ RPE 8, Romanian Deadlift 3x10 ..."
// exercisesFromNotes() reads that main set into exercises, so a plan made
// before the function returned structured exercises still gets the logger,
// the art and the set grid.

import { MUSCLES } from './exercises.js';
import { upgradeExercises } from './sets.js';

export const SPLIT_GROUPS = MUSCLES;
const MAJOR = ['Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings', 'Glutes'];

const d = (label, ...groups) => ({ label, groups });
const PUSH = ['Chest', 'Shoulders', 'Triceps'];
const PULL = ['Back', 'Biceps', 'Traps'];
const LEGS = ['Quads', 'Hamstrings', 'Glutes', 'Calves'];

export const SPLIT_PRESETS = [
  { id: 'full3', name: 'Full body ×3', days: [d('Full body A', 'Full body', 'Chest', 'Back', 'Quads'), d('Full body B', 'Full body', 'Shoulders', 'Hamstrings', 'Glutes'), d('Full body C', 'Full body', 'Back', 'Quads', 'Abs')] },
  { id: 'upper-lower', name: 'Upper / Lower', days: [d('Upper', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'), d('Lower', ...LEGS), d('Upper', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'), d('Lower', ...LEGS, 'Abs')] },
  { id: 'ppl', name: 'Push / Pull / Legs', days: [d('Push', ...PUSH), d('Pull', ...PULL), d('Legs', ...LEGS)] },
  { id: 'arnold', name: 'Arnold split', days: [d('Chest & back', 'Chest', 'Back'), d('Shoulders & arms', 'Shoulders', 'Biceps', 'Triceps', 'Forearms'), d('Legs', ...LEGS, 'Abs'), d('Chest & back', 'Chest', 'Back'), d('Shoulders & arms', 'Shoulders', 'Biceps', 'Triceps', 'Forearms'), d('Legs', ...LEGS, 'Abs')] },
  { id: 'bro5', name: 'Bro split ×5', days: [d('Chest', 'Chest'), d('Back', 'Back', 'Traps'), d('Shoulders', 'Shoulders'), d('Arms', 'Biceps', 'Triceps', 'Forearms'), d('Legs', ...LEGS)] },
  { id: 'ppl6', name: 'Push / Pull / Legs ×6', days: [d('Push', ...PUSH), d('Pull', ...PULL), d('Legs', ...LEGS), d('Push', ...PUSH), d('Pull', ...PULL), d('Legs', ...LEGS)] },
];

/** A fresh copy of a preset (so edits never touch the table above). */
export function presetSplit(id) {
  const p = SPLIT_PRESETS.find((x) => x.id === id) || SPLIT_PRESETS[0];
  return { preset: p.id, days: p.days.map((x) => ({ label: x.label, groups: [...x.groups] })) };
}

/** Clean anything (wizard state, settings, the network) into a valid split. */
export function normalizeSplit(raw) {
  const days = (Array.isArray(raw?.days) ? raw.days : []).slice(0, 7).map((x, i) => {
    const rest = !!x?.rest;
    const groups = rest ? [] : [...new Set((Array.isArray(x?.groups) ? x.groups : []).filter((g) => SPLIT_GROUPS.includes(g)))];
    const label = String(x?.label ?? '').trim().slice(0, 24) || (rest ? 'Rest' : `Day ${i + 1}`);
    return rest ? { label, groups, rest: true } : { label, groups };
  });
  const preset = SPLIT_PRESETS.some((p) => p.id === raw?.preset) ? raw.preset : 'custom';
  return { preset, days };
}

/** Advice about a split; never stops the plan from being generated. */
export function splitWarnings(split, { trainingDays = 7 } = {}) {
  const days = split?.days || [];
  const train = days.filter((x) => !x.rest);
  const out = [];
  if (!train.length) return ['Add at least one training day.'];
  if (train.length > trainingDays) out.push(`${train.length} gym days, but only ${trainingDays} training days a week. The coach will fit what it can.`);
  train.forEach((x) => { if (!x.groups.length) out.push(`${x.label} has no muscle groups yet.`); });
  const hit = new Set(train.flatMap((x) => x.groups));
  const missing = hit.has('Full body') ? [] : MAJOR.filter((m) => !hit.has(m));
  if (missing.length) out.push(`No day trains ${missing.join(', ')}.`);
  for (let i = 1; i < days.length; i++) {
    if (days[i].rest || days[i - 1].rest) continue;
    const both = days[i].groups.filter((g) => g !== 'Full body' && g !== 'Abs' && days[i - 1].groups.includes(g));
    if (both.length) out.push(`${days[i - 1].label} and ${days[i].label} both train ${both.join(', ')} on back-to-back days.`);
  }
  return out;
}

/** Move one group chip from a day to another (in place). Returns whether it moved. */
export function moveGroup(split, fromDay, groupIdx, toDay) {
  const from = split.days[fromDay]; const to = split.days[toDay];
  if (!from || !to || fromDay === toDay || to.rest) return false;
  const g = from.groups[groupIdx];
  if (!g) return false;
  from.groups.splice(groupIdx, 1);
  if (!to.groups.includes(g)) to.groups.push(g);
  return true;
}

// ---- AI sessions -> exercises -------------------------------------------------------------------

const MAIN = /\[\s*main(?:\s*set)?\s*\]([^[]*)/i;
// "Back Squat 4x8 @ RPE 8", "Bulgarian Split Squat 3x10 each leg @ RPE 8", "Plank 3x45s"
const ITEM = /^(.*?[a-z].*?)\s+(\d{1,2})\s*[x×]\s*(\d{1,3}(?:\s*[-–]\s*\d{1,3})?\s*(?:s|sec|secs|seconds|min)?)\b\s*(.*)$/i;

/** Old-shape items ({ name, sets, reps, notes }) from a "[Main Set]" line; [] when there is none. */
export function itemsFromNotes(notes) {
  const m = MAIN.exec(String(notes || ''));
  if (!m) return [];
  return m[1].split(/\s*[,;]\s*|\n+/).map((t) => t.trim()).filter(Boolean).map((t) => {
    const hit = ITEM.exec(t);
    if (!hit) return null;
    const [, name, sets, reps, rest] = hit;
    const per = /\b(each|per)\s+(leg|side|arm)\b/i.exec(rest);
    const rpe = /rpe\s*(\d+(?:\.\d)?)/i.exec(rest);
    return {
      name: name.replace(/[:\-–]+$/, '').trim(),
      sets: Number(sets),
      reps: `${reps.replace(/\s+/g, '')}${per ? ` / ${per[2].toLowerCase()}` : ''}`,
      notes: rpe ? `RPE ${rpe[1]}` : '',
    };
  }).filter(Boolean).slice(0, 12);
}

/**
 * A gym session from the AI that has no exercises yet gets them from its
 * notes, once (`notesParsed` stops it coming back after you delete them).
 * Returns the same object when there's nothing to do.
 */
export function deriveGymExercises(w) {
  if (!w || w.type !== 'gym' || w.notesParsed) return w;
  if (Array.isArray(w.exercises) && w.exercises.length) return w;
  const items = itemsFromNotes(w.notes);
  if (!items.length) return w;
  return { ...w, exercises: upgradeExercises(items), notesParsed: true };
}

/** Does the notes' main set now live in the exercises (so the text block can hide)? */
export const mainSetIsExercises = (w) => !!(w?.notesParsed || w?.ai) && w?.type === 'gym' && (w.exercises || []).length > 0;
