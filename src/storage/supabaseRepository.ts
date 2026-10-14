import { createClient } from '@supabase/supabase-js';
import type { Award, Photo, Profile, Test, Unit, Word, WordState } from '../domain/types';
import type { Repository } from './repository';

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL as string, import.meta.env.VITE_SUPABASE_ANON_KEY as string);

type ProfileRow = { id: string; user_id: string; admin_id: string | null; name: string; email: string | null; settings: { keep_photos?: boolean }; created_at: string };
type TestRow = { id: string; profile_id: string; name: string; lang_from: string; lang_to: string; test_date: string | null; format: Test['format']; topics: string[] | null; status: Test['status']; created_at: string };

type UnitRow = { id: string; test_id: string; label: string; sort: number };
type WordRow = { id: string; unit_id: string; source: string; target: string; example: string | null; priority: boolean; status: Word['status'] };
type StateRow = { word_id: string; box: number; due_at: string; streak: number; lapses: number; last_result: boolean | null };
type AwardRow = { id: string; profile_id: string; kind: Award['kind']; ref_id: string | null; ref: string; value: number; awarded_at: string };
type PhotoRow = { id: string; test_id: string; kind: Photo['kind']; storage_path: string; status: Photo['status']; created_at: string };

const toProfile = (r: ProfileRow, uid: string): Profile => ({ id: r.id, name: r.name, settings: { keepPhotos: !!r.settings?.keep_photos }, createdAt: r.created_at, own: r.user_id === uid, ...(r.email ? { email: r.email } : {}) });
const callAdmin = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke('admin', { body });
  if (error) { const b = await (error as { context?: Response }).context?.json?.().catch(() => null); throw new Error(b?.error ?? 'Aktion fehlgeschlagen'); }
  if (data?.error) throw new Error(data.error);
  return data;
};
const toTest = (r: TestRow): Test => ({ id: r.id, profileId: r.profile_id, name: r.name, langFrom: r.lang_from, langTo: r.lang_to, testDate: r.test_date, format: r.format, topics: r.topics ?? null, status: r.status, createdAt: r.created_at });

const toUnit = (r: UnitRow): Unit => ({ id: r.id, testId: r.test_id, label: r.label, sort: r.sort });
const toWord = (r: WordRow): Word => ({ id: r.id, unitId: r.unit_id, source: r.source, target: r.target, example: r.example, priority: r.priority, status: r.status });
const toState = (r: StateRow): WordState => ({ wordId: r.word_id, box: r.box, dueAt: r.due_at, streak: r.streak, lapses: r.lapses, lastResult: r.last_result });
const toAward = (r: AwardRow): Award => ({ id: r.id, profileId: r.profile_id, kind: r.kind, refId: r.ref_id, ref: r.ref, value: r.value, awardedAt: r.awarded_at });
const toPhoto = (r: PhotoRow): Photo => ({ id: r.id, testId: r.test_id, kind: r.kind, storagePath: r.storage_path, status: r.status, createdAt: r.created_at });

// crypto.randomUUID exists only in secure contexts (https/localhost); the phone test over http://192.168… needs the fallback
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : [...crypto.getRandomValues(new Uint8Array(16))].map((b, i) => ((i === 6 ? (b & 0x0f) | 0x40 : i === 8 ? (b & 0x3f) | 0x80 : b).toString(16).padStart(2, '0')) + ([3, 5, 7, 9].includes(i) ? '-' : '')).join(''));

const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };

export const supabaseRepository: Repository = {
  async getRole() {
    const { data } = await supabase.from('admins').select('user_id').maybeSingle();
    return data ? 'admin' : 'student';
  },
  async listProfiles() {
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('profiles').select('*').order('created_at');
    fail(error);
    return (data as ProfileRow[]).map((r) => toProfile(r, u.user?.id ?? ''));
  },
  async addProfile(name) {
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('profiles').insert({ name, user_id: u.user?.id }).select().single();
    fail(error);
    return toProfile(data as ProfileRow, u.user?.id ?? '');
  },
  async listAllAwards() {
    const { data, error } = await supabase.from('awards').select('*');
    fail(error);
    return (data as AwardRow[]).map(toAward);
  },
  async adminCreateStudent(s) { await callAdmin({ action: 'create-student', ...s }); },
  async adminUpdateStudent(s) { await callAdmin({ action: 'update-student', ...s }); },
  async deleteProfile(id) {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    fail(error);
  },
  async listTests(profileId) {
    const { data, error } = await supabase.from('tests').select('*').eq('profile_id', profileId).order('created_at');
    fail(error);
    return (data as TestRow[]).map(toTest);
  },
  async listAllTests() {
    const { data, error } = await supabase.from('tests').select('*').order('created_at', { ascending: false });
    fail(error);
    return (data as TestRow[]).map(toTest);
  },
  async getTest(id) {
    const { data, error } = await supabase.from('tests').select('*').eq('id', id).single();
    fail(error);
    return toTest(data as TestRow);
  },
  async addTest(profileId, t) {
    const { data, error } = await supabase.from('tests').insert({ profile_id: profileId, name: t.name, lang_from: t.langFrom, lang_to: t.langTo, test_date: t.testDate }).select().single();
    fail(error);
    return toTest(data as TestRow);
  },
  async updateTest(id, p) {
    const row: Record<string, unknown> = {};
    if (p.name !== undefined) row.name = p.name;
    if (p.testDate !== undefined) row.test_date = p.testDate;
    if (p.topics !== undefined) row.topics = p.topics;
    const { error } = await supabase.from('tests').update(row).eq('id', id);
    fail(error);
  },
  async listPhotos(testId) {
    const { data, error } = await supabase.from('photos').select('*').eq('test_id', testId).neq('status', 'deleted').order('created_at');
    fail(error);
    return (data as PhotoRow[]).map(toPhoto);
  },
  async addPhoto(test, kind, jpeg) {
    const { data: u } = await supabase.auth.getUser();
    // path = <user_id>/<profile_id>/<test_id>/<uuid>.jpg — the storage policy checks the first folder against auth.uid()
    const path = `${u.user?.id}/${test.profileId}/${test.id}/${uuid()}.jpg`;
    const up = await supabase.storage.from('photos').upload(path, jpeg, { contentType: 'image/jpeg' });
    fail(up.error);
    const { data, error } = await supabase.from('photos').insert({ test_id: test.id, kind, storage_path: path }).select().single();
    if (error) { await supabase.storage.from('photos').remove([path]); fail(error); }
    return toPhoto(data as PhotoRow);
  },
  async deletePhoto(photo) {
    const rm = await supabase.storage.from('photos').remove([photo.storagePath]);
    fail(rm.error);
    const { error } = await supabase.from('photos').delete().eq('id', photo.id);
    fail(error);
  },
  async photoUrl(photo) {
    const { data, error } = await supabase.storage.from('photos').createSignedUrl(photo.storagePath, 3600, { transform: { width: 300 } });
    if (error) {
      // image transforms are a paid feature; fall back to the plain signed URL
      const r = await supabase.storage.from('photos').createSignedUrl(photo.storagePath, 3600);
      fail(r.error);
      return r.data!.signedUrl;
    }
    return data.signedUrl;
  },
  async extractPhoto(photoId) {
    const { data, error } = await supabase.functions.invoke('extract', { body: { photoId } });
    if (error) {
      const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
      throw new Error(body?.error ?? 'Auswertung fehlgeschlagen');
    }
    if (data?.error) throw new Error(data.error);
    return data;
  },
  async listUnits(testId) {
    const { data, error } = await supabase.from('units').select('*').eq('test_id', testId).order('sort');
    fail(error);
    return (data as UnitRow[]).map(toUnit);
  },
  async listWords(testId) {
    const { data, error } = await supabase.from('words').select('*, units!inner(test_id)').eq('units.test_id', testId).order('created_at');
    fail(error);
    return (data as WordRow[]).map(toWord);
  },
  async updateWord(id, p) {
    const row: Record<string, unknown> = {};
    if (p.source !== undefined) row.source = p.source;
    if (p.target !== undefined) row.target = p.target;
    if (p.example !== undefined) row.example = p.example;
    if (p.priority !== undefined) row.priority = p.priority;
    if (p.unitId !== undefined) row.unit_id = p.unitId;
    const { error } = await supabase.from('words').update(row).eq('id', id);
    fail(error);
  },
  async deleteWord(id) {
    const { error } = await supabase.from('words').delete().eq('id', id);
    fail(error);
  },
  async activateWords(testId) {
    const { data: units, error: ue } = await supabase.from('units').select('id').eq('test_id', testId);
    fail(ue);
    const { error } = await supabase.from('words').update({ status: 'active' }).eq('status', 'review').in('unit_id', (units ?? []).map((u) => u.id));
    fail(error);
  },
  async deletePhotoFiles(testId) {
    const { data, error } = await supabase.from('photos').select('id, storage_path').eq('test_id', testId).neq('status', 'deleted');
    fail(error);
    if (!data?.length) return;
    const rm = await supabase.storage.from('photos').remove(data.map((p) => p.storage_path));
    fail(rm.error);
    const up = await supabase.from('photos').update({ status: 'deleted' }).in('id', data.map((p) => p.id));
    fail(up.error);
  },
  async listWordStates(testId) {
    const { data, error } = await supabase.from('word_state').select('*, words!inner(unit_id, units!inner(test_id))').eq('words.units.test_id', testId);
    fail(error);
    return (data as StateRow[]).map(toState);
  },
  async listAwards(profileId) {
    const { data, error } = await supabase.from('awards').select('*').eq('profile_id', profileId);
    fail(error);
    return (data as AwardRow[]).map(toAward);
  },
  async saveAward(a) {
    const { data } = await supabase.from('awards').select('id, value').eq('profile_id', a.profileId).eq('kind', a.kind).eq('ref_id', a.refId).eq('ref', a.ref).maybeSingle();
    if (data && data.value >= a.value) return;
    const row = { profile_id: a.profileId, kind: a.kind, ref_id: a.refId, ref: a.ref, value: a.value, awarded_at: a.awardedAt };
    const { error } = data ? await supabase.from('awards').update(row).eq('id', data.id) : await supabase.from('awards').insert(row);
    fail(error);
  },
  async resetLesson(profileId, unitId, n, wordIds) {
    const a = await supabase.from('awards').delete().eq('profile_id', profileId).eq('ref_id', unitId).like('ref', `lesson:${n}%`);
    fail(a.error);
    const s = await supabase.from('word_state').delete().in('word_id', wordIds);
    fail(s.error);
  },
  async resetTestProgress(profileId, unitIds, wordIds) {
    if (unitIds.length) { const a = await supabase.from('awards').delete().eq('profile_id', profileId).in('ref_id', unitIds); fail(a.error); }
    if (wordIds.length) { const s = await supabase.from('word_state').delete().in('word_id', wordIds); fail(s.error); }
    if (unitIds.length) { const se = await supabase.from('sessions').delete().eq('profile_id', profileId).in('unit_id', unitIds); fail(se.error); }
  },
  async saveWordState(s) {
    const { error } = await supabase.from('word_state').upsert({ word_id: s.wordId, box: s.box, due_at: s.dueAt, streak: s.streak, lapses: s.lapses, last_result: s.lastResult, updated_at: new Date().toISOString() });
    fail(error);
  },
  async addSession(s) {
    const { error } = await supabase.from('sessions').insert({ profile_id: s.profileId, kind: s.kind, unit_id: s.unitId, started_at: s.startedAt, ended_at: new Date().toISOString(), items: s.items, score: s.score ?? null, max_score: s.maxScore ?? null });
    fail(error);
  },
  async exportAll() {
    const out: Record<string, unknown[]> = {};
    for (const t of ['profiles', 'tests', 'units', 'words', 'photos', 'word_state', 'sessions', 'awards', 'streaks']) {
      const { data, error } = await supabase.from(t).select('*');
      fail(error);
      out[t] = data ?? [];
    }
    return out;
  },
};
