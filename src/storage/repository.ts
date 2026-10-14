import type { Award, Photo, PhotoKind, Profile, Role, Test, Unit, Word, WordState } from '../domain/types';

/** Storage boundary. S0: profiles; S1: tests + photos; grows per slice. */
export interface Repository {
  getRole(): Promise<Role>;
  listProfiles(): Promise<Profile[]>;
  listAllAwards(): Promise<Award[]>;
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
  listWords(testId: string): Promise<Word[]>;
  updateWord(id: string, p: Partial<Pick<Word, 'source' | 'target' | 'example' | 'priority' | 'unitId'>>): Promise<void>;
  deleteWord(id: string): Promise<void>;
  /** review → active for every word of the test */
  activateWords(testId: string): Promise<void>;
  /** removes the files from the bucket, keeps the rows with status deleted (D-004 default) */
  deletePhotoFiles(testId: string): Promise<void>;
  listWordStates(testId: string): Promise<WordState[]>;
  listAwards(profileId: string): Promise<Award[]>;
  /** upsert on (profile, kind, unit, ref); keeps the better value */
  saveAward(a: Award): Promise<void>;
  /** lesson reset: removes its stars/crown and the ladder state of its sentences */
  resetLesson(profileId: string, unitId: string, n: number, wordIds: string[]): Promise<void>;
  /** whole test: stars, crowns, ladder state and study sessions of its units */
  resetTestProgress(profileId: string, unitIds: string[], wordIds: string[]): Promise<void>;
  saveWordState(s: WordState): Promise<void>;
  addSession(s: { profileId: string; kind: 'study' | 'mock'; unitId: string | null; startedAt: string; items: unknown[]; score?: number; maxScore?: number }): Promise<void>;
  /** everything the user owns, for the JSON backup (blueprint §7) */
  exportAll(): Promise<Record<string, unknown[]>>;
}
