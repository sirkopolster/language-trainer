import type { Photo, PhotoKind, Profile, Test, Unit, Word, WordState } from '../domain/types';

/** Storage boundary. S0: profiles; S1: tests + photos; grows per slice. */
export interface Repository {
  listProfiles(): Promise<Profile[]>;
  addProfile(name: string): Promise<Profile>;
  deleteProfile(id: string): Promise<void>;
  listTests(profileId: string): Promise<Test[]>;
  /** all tests the user owns, newest first (home dashboard) */
  listAllTests(): Promise<Test[]>;
  getTest(id: string): Promise<Test>;
  addTest(profileId: string, t: { name: string; langFrom: string; langTo: string; testDate: string | null }): Promise<Test>;
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
  saveWordState(s: WordState): Promise<void>;
  addSession(s: { profileId: string; kind: 'study' | 'mock'; unitId: string | null; startedAt: string; items: unknown[]; score?: number; maxScore?: number }): Promise<void>;
  /** everything the user owns, for the JSON backup (blueprint §7) */
  exportAll(): Promise<Record<string, unknown[]>>;
}
