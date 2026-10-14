// Domain types — mirror docs/data-model.md. Code English, UI German.

/** own = the profile of the logged-in student; email only visible to the admin (from auth metadata) */
export interface Profile { id: string; name: string; settings: { keepPhotos: boolean }; createdAt: string; own: boolean; email?: string }
export type Role = 'admin' | 'student';

export type TestStatus = 'setup' | 'active' | 'done';
export interface Test { id: string; profileId: string; name: string; langFrom: string; langTo: string; testDate: string | null; format: TestFormat | null; /** what the test covers; null = never prefilled */ topics: string[] | null; status: TestStatus; createdAt: string }

export type SectionType = 'translate' | 'gap' | 'choice' | 'match' | 'other';
export interface TestSection { type: SectionType; direction: string; items: number; points: number; label?: string }
export interface TestFormat { sections: TestSection[]; totalPoints: number; passMark: number | null }

export type PhotoKind = 'vocab' | 'test';
export type PhotoStatus = 'uploaded' | 'extracted' | 'failed' | 'deleted';
export interface Photo { id: string; testId: string; kind: PhotoKind; storagePath: string; status: PhotoStatus; createdAt: string }

export interface Unit { id: string; testId: string; label: string; sort: number }

export type WordStatus = 'review' | 'active' | 'retired';
export interface Word { id: string; unitId: string; source: string; target: string; example: string | null; priority: boolean; status: WordStatus }

export interface WordState { wordId: string; box: number; dueAt: string; streak: number; lapses: number; lastResult: boolean | null }

export interface Streak { profileId: string; current: number; longest: number; lastDay: string | null }
/** refId = unit, ref = 'lesson:<n>:<part>' (star, value 0–3) or 'lesson:<n>' (crown) */
export interface Award { id: string; profileId: string; kind: 'star' | 'crown'; refId: string | null; ref: string; value: number; awardedAt: string }
