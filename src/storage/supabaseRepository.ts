import { createClient } from '@supabase/supabase-js';
import type { Profile, Test } from '../domain/types';
import type { Repository } from './repository';

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL as string, import.meta.env.VITE_SUPABASE_ANON_KEY as string);

type ProfileRow = { id: string; name: string; settings: { keep_photos?: boolean }; created_at: string };
type TestRow = { id: string; profile_id: string; name: string; lang_from: string; lang_to: string; test_date: string | null; format: Test['format']; status: Test['status']; created_at: string };

const toProfile = (r: ProfileRow): Profile => ({ id: r.id, name: r.name, settings: { keepPhotos: !!r.settings?.keep_photos }, createdAt: r.created_at });
const toTest = (r: TestRow): Test => ({ id: r.id, profileId: r.profile_id, name: r.name, langFrom: r.lang_from, langTo: r.lang_to, testDate: r.test_date, format: r.format, status: r.status, createdAt: r.created_at });

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
