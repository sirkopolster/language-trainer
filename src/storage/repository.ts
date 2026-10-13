import type { Photo, PhotoKind, Profile, Test } from '../domain/types';

/** Storage boundary. S0: profiles; S1: tests + photos; grows per slice. */
export interface Repository {
  listProfiles(): Promise<Profile[]>;
  addProfile(name: string): Promise<Profile>;
  deleteProfile(id: string): Promise<void>;
  listTests(profileId: string): Promise<Test[]>;
  getTest(id: string): Promise<Test>;
  addTest(profileId: string, t: { name: string; langFrom: string; langTo: string; testDate: string | null }): Promise<Test>;
  listPhotos(testId: string): Promise<Photo[]>;
  /** uploads an already resized JPEG to the private bucket and records the row */
  addPhoto(test: Test, kind: PhotoKind, jpeg: Blob): Promise<Photo>;
  deletePhoto(photo: Photo): Promise<void>;
  /** short-lived URL for a thumbnail (bucket is private) */
  photoUrl(photo: Photo): Promise<string>;
  /** everything the user owns, for the JSON backup (blueprint §7) */
  exportAll(): Promise<Record<string, unknown[]>>;
}
