import { createClient } from '@supabase/supabase-js';
import type { Photo, Profile, Test } from '../domain/types';
import type { Repository } from './repository';

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL as string, import.meta.env.VITE_SUPABASE_ANON_KEY as string);

type ProfileRow = { id: string; name: string; settings: { keep_photos?: boolean }; created_at: string };
type TestRow = { id: string; profile_id: string; name: string; lang_from: string; lang_to: string; test_date: string | null; format: Test['format']; status: Test['status']; created_at: string };

type PhotoRow = { id: string; test_id: string; kind: Photo['kind']; storage_path: string; status: Photo['status']; created_at: string };

const toProfile = (r: ProfileRow): Profile => ({ id: r.id, name: r.name, settings: { keepPhotos: !!r.settings?.keep_photos }, createdAt: r.created_at });
const toTest = (r: TestRow): Test => ({ id: r.id, profileId: r.profile_id, name: r.name, langFrom: r.lang_from, langTo: r.lang_to, testDate: r.test_date, format: r.format, status: r.status, createdAt: r.created_at });

const toPhoto = (r: PhotoRow): Photo => ({ id: r.id, testId: r.test_id, kind: r.kind, storagePath: r.storage_path, status: r.status, createdAt: r.created_at });

const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };

export const supabaseRepository: Repository = {
  async listProfiles() {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at');
    fail(error);
    return (data as ProfileRow[]).map(toProfile);
  },
  async addProfile(name) {
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('profiles').insert({ name, user_id: u.user?.id }).select().single();
    fail(error);
    return toProfile(data as ProfileRow);
  },
  async deleteProfile(id) {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    fail(error);
  },
  async listTests(profileId) {
    const { data, error } = await supabase.from('tests').select('*').eq('profile_id', profileId).order('created_at');
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
  async listPhotos(testId) {
    const { data, error } = await supabase.from('photos').select('*').eq('test_id', testId).neq('status', 'deleted').order('created_at');
    fail(error);
    return (data as PhotoRow[]).map(toPhoto);
  },
  async addPhoto(test, kind, jpeg) {
    const { data: u } = await supabase.auth.getUser();
    // path = <user_id>/<profile_id>/<test_id>/<uuid>.jpg — the storage policy checks the first folder against auth.uid()
    const path = `${u.user?.id}/${test.profileId}/${test.id}/${crypto.randomUUID()}.jpg`;
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
