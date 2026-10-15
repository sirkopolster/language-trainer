import type { Account, Award, Photo, PhotoKind, Profile, Role, Test, Unit, Word, WordState } from '../domain/types';

/** Storage boundary. S0: profiles; S1: tests + photos; grows per slice. */
export interface Repository {
  getRole(): Promise<Role>;
  /** role + display name (admin: admins.name, student: own profile name) + e-mail */
  getAccount(): Promise<Account>;
  updateAdminName(name: string): Promise<void>;
  /** sign in with e-mail or name via the login function */
  signIn(identifier: string, password: string): Promise<void>;
  listProfiles(): Promise<Profile[]>;
  listAllAwards(): Promise<Award[]>;
  listAllUnits(): Promise<Unit[]>;
  listAllWords(): Promise<Word[]>;
  /** started_at, kind and number of answered items per session (home stats) */
  listSessions(profileId: string): Promise<{ startedAt: string; kind: 'study' | 'mock'; items: number }[]>;
  /** mock attempts of one test, newest first */
  listMocks(testId: string): Promise<{ startedAt: string; score: number; maxScore: number; passed: boolean }[]>;
  listAllSessions(): Promise<{ profileId: string; unitId: string | null; startedAt: string; kind: 'study' | 'mock'; items: number }[]>;
  adminCreateStudent(s: { name: string; email: string; password: string; profileId?: string }): Promise<void>;
  adminUpdateStudent(s: { profileId: string; name?: string; email?: string; password?: string }): Promise<void>;
  addProfile(name: string): Promise<Profile>;
  deleteProfile(id: string): Promise<void>;
  listTests(profileId: string): Promise<Test[]>;
  /** all tests the user owns, newest first (home dashboard) */
  listAllTests(): Promise<Test[]>;
  getTest(id: string): Promise<Test>;
  addTest(profileId: string, t: { name: string; langFrom: string; langTo: string; testDate: string | null }): Promise<Test>;
  updateTest(id: string, p: Partial<Pick<Test, 'name' | 'testDate' | 'topics'>>): Promise<void>;
  listPhotos(testId: string): Promise<Photo[]>;
  /** uploads an already resized JPEG to the private bucket and records the row */
  addPhoto(test: Test, kind: PhotoKind, jpeg: Blob): Promise<Photo>;
  deletePhoto(photo: Photo): Promise<void>;
  /** short-lived URL for a thumbnail (bucket is private) */
  photoUrl(photo: Photo): Promise<string>;
  /** Edge Function `extract`: one photo → words in review / test format */
  extractPhoto(photoId: string): Promise<{ kind: 'vocab'; unit: string; words: number } | { kind: 'test'; sections: number; totalPoints: number }>;
  listUnits(testId: string): Promise<Unit[]>;
  /** Edge Function `grammar`: builds Spezialteil A (tense) or B (negation) from the test's sentences */
  generateSpecial(testId: string, kind: 'tense' | 'negation'): Promise<{ pairs: number }>;
  listWords(testId: string): Promise<Word[]>;
  updateWord(id: string, p: Partial<Pick<Word, 'source' | 'target' | 'example' | 'priority' | 'unitId'>>): Promise<void>;
  deleteWord(id: string): Promise<void>;
  /** review → active for every word of the test */
  activateWords(testId: string): Promise<void>;
  /** removes the files from the bucket, keeps the rows with status deleted (D-004 default) */
  deletePhotoFiles(testId: string): Promise<void>;
  /** the learner's own profile (admins have one too), null before it is created */
  getMyProfile(): Promise<Profile | null>;
  /** states of one learner for one test */
  listWordStates(testId: string, profileId: string): Promise<WordState[]>;
  listAwards(profileId: string): Promise<Award[]>;
  /** upsert on (profile, kind, unit, ref); keeps the better value */
  saveAward(a: Award): Promise<void>;
  /** lesson reset: removes its stars/crown and the ladder state of its sentences */
  resetLesson(profileId: string, unitId: string, n: number, wordIds: string[]): Promise<void>;
  /** all learners' states (admin sees every child) for the result overview */
  listAllWordStates(): Promise<WordState[]>;
  /** whole test: stars, crowns, ladder state and study sessions of its units */
  resetTestProgress(profileId: string, unitIds: string[], wordIds: string[]): Promise<void>;
  saveWordState(s: WordState): Promise<void>;
  addSession(s: { profileId: string; kind: 'study' | 'mock'; unitId: string | null; startedAt: string; items: unknown[]; score?: number; maxScore?: number }): Promise<void>;
  /** everything the user owns, for the JSON backup (blueprint §7) */
  exportAll(): Promise<Record<string, unknown[]>>;
}
