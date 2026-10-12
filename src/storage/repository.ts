import type { Profile, Test } from '../domain/types';

/** Storage boundary. S0: profiles + tests only; grows per slice. */
export interface Repository {
  listProfiles(): Promise<Profile[]>;
  addProfile(name: string): Promise<Profile>;
  deleteProfile(id: string): Promise<void>;
  listTests(profileId: string): Promise<Test[]>;
  /** everything the user owns, for the JSON backup (blueprint §7) */
  exportAll(): Promise<Record<string, unknown[]>>;
}
