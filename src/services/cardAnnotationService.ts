import { CardAnnotation, OfficialCardAnnotation, UserAnnotationData } from '../types';
import { OFFICIAL_CARD_ANNOTATIONS, getAnnotationByCardId } from '../constants/cardAnnotations';
import { readJsonRecordWithBackup, requireLocalSave, removeJsonWithBackup } from '../lib/safeLocalStorage';
import { TAROT_CARDS } from '../constants';

const STORAGE_KEY = 'tarot_user_annotations';
const CURRENT_VERSION = 1;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isUserAnnotationData = (value: unknown): value is UserAnnotationData => (
  isRecord(value)
  && typeof value.userId === 'string'
  && isRecord(value.annotations)
  && typeof value.version === 'number'
  && typeof value.lastUpdated === 'string'
);

export class CardAnnotationService {
  private cache: UserAnnotationData | null = null;
  private runtimeUserId: string | null = null;
  private scope = 'guest';
  private revision = 0;
  private listeners = new Set<() => void>();
  public subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  public getRevision = () => this.revision;
  public getScope = () => this.scope;
  private notify() { this.revision += 1; this.listeners.forEach(listener => listener()); }
  private get storageKey() { return `${STORAGE_KEY}_${this.scope}`; }

  public setScope(uid?: string) {
    const scope = uid || 'guest';
    const scopeChanged = this.scope !== scope;
    if (scopeChanged) { this.scope = scope; this.cache = null; }
    const current = this.getUserData();
    const owner = readJsonRecordWithBackup<{ uid: string }>('tarot_annotations_legacy_owner')?.uid;
    {
      const canClaimLegacy = !owner || owner === scope;
      const legacy = canClaimLegacy ? readJsonRecordWithBackup<UserAnnotationData & Record<string, unknown>>(STORAGE_KEY) : null;
      const guest = scope !== 'guest' ? readJsonRecordWithBackup<UserAnnotationData & Record<string, unknown>>(`${STORAGE_KEY}_guest`) : null;
      const meanings = canClaimLegacy ? readJsonRecordWithBackup<Record<string, string>>('tarot_personal_meanings') || {} : {};
      const annotations: Record<string, Partial<CardAnnotation>> = {};
      for (const source of [legacy?.annotations || {}, guest?.annotations || {}, current.annotations]) {
        for (const [id, entry] of Object.entries(source)) annotations[id] = entry.deletedAt ? entry : { ...annotations[id], ...entry };
      }
      for (const card of TAROT_CARDS) {
        if (meanings[card.name] && annotations[card.id]?.personalMeaning === undefined) {
          annotations[card.id] = { ...annotations[card.id], personalMeaning: meanings[card.name] };
        }
      }
      if (legacy || guest || Object.keys(meanings).length) {
        if (scope !== 'guest' && canClaimLegacy) requireLocalSave('tarot_annotations_legacy_owner', { uid: scope });
        for (const [cardId, entry] of Object.entries(annotations)) {
          annotations[cardId] = { ...entry, cardId, userId: scope, updatedAt: entry.updatedAt || '1970-01-01T00:00:00.000Z' };
        }
        if (JSON.stringify(annotations) !== JSON.stringify(current.annotations)) this.saveUserData({ ...current, annotations });
        if (scope !== 'guest') {
          // Only retire the unscoped source after the owned copy has been written.
          if (canClaimLegacy) removeJsonWithBackup(STORAGE_KEY);
          removeJsonWithBackup(`${STORAGE_KEY}_guest`);
          if (canClaimLegacy) removeJsonWithBackup('tarot_personal_meanings');
        }
      }
    }
    if (scopeChanged) this.notify();
  }

  private createUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private getUserId(): string {
    if (this.scope !== 'guest') return this.scope;
    if (this.runtimeUserId) return this.runtimeUserId;

    let storedUserId: string | null = null;
    try {
      storedUserId = localStorage.getItem('tarot_user_id');
    } catch {
      this.runtimeUserId = this.createUserId();
      return this.runtimeUserId;
    }

    if (!storedUserId) {
      const newUserId = this.createUserId();
      try {
        localStorage.setItem('tarot_user_id', newUserId);
      } catch {
        this.runtimeUserId = newUserId;
      }
      return newUserId;
    }

    return storedUserId;
  }

  private getUserData(): UserAnnotationData {
    if (this.cache) {
      return this.cache;
    }

    const stored = readJsonRecordWithBackup(this.storageKey);
    if (isUserAnnotationData(stored)) {
      this.cache = stored;
      return stored;
    }

    const newData: UserAnnotationData = {
      userId: this.getUserId(),
      annotations: {},
      version: CURRENT_VERSION,
      lastUpdated: new Date().toISOString()
    };
    
    this.cache = newData;
    return newData;
  }

  private saveUserData(data: UserAnnotationData): void {
    data.lastUpdated = new Date().toISOString();
    data.version = CURRENT_VERSION;
    requireLocalSave(this.storageKey, data);
    this.cache = data;
    this.notify();
  }

  public getUserAnnotation(cardId: string): Partial<CardAnnotation> | null {
    const userData = this.getUserData();
    const entry = userData.annotations[cardId];
    return entry?.deletedAt ? null : entry || null;
  }

  public getAllUserAnnotations(): Record<string, Partial<CardAnnotation>> {
    return { ...this.getUserData().annotations };
  }

  public saveUserAnnotation(cardId: string, annotation: Partial<CardAnnotation>): void {
    const current = this.getUserData();
    const userData = { ...current, annotations: { ...current.annotations } };
    
    const existingAnnotation = userData.annotations[cardId] || {};
    const updatedAnnotation: Partial<CardAnnotation> = {
      ...(existingAnnotation.deletedAt ? {} : existingAnnotation),
      ...annotation,
      cardId,
      userId: userData.userId,
      updatedAt: new Date(Math.max(Date.now(), new Date(existingAnnotation.updatedAt || 0).getTime() + 1)).toISOString(),
    };

    if (!existingAnnotation.createdAt) {
      updatedAnnotation.createdAt = new Date().toISOString();
    }

    userData.annotations[cardId] = updatedAnnotation;
    this.saveUserData(userData);
  }

  public deleteUserAnnotation(cardId: string): void {
    const current = this.getUserData();
    const now = new Date(Math.max(Date.now(), new Date(current.annotations[cardId]?.updatedAt || 0).getTime() + 1)).toISOString();
    this.saveUserData({ ...current, annotations: { ...current.annotations, [cardId]: { cardId, userId: this.scope, deletedAt: now, updatedAt: now } } });
  }

  public resetAnnotationToOfficial(cardId: string): void {
    this.deleteUserAnnotation(cardId);
  }

  public getMergedAnnotation(cardId: string): CardAnnotation {
    return this.mergeAnnotation(cardId, getAnnotationByCardId(cardId));
  }

  private mergeAnnotation(cardId: string, official?: OfficialCardAnnotation): CardAnnotation {
    const user = this.getUserAnnotation(cardId);

    const merged: CardAnnotation = {
      cardId,
      userId: this.getUserId(),
      numerology: user?.numerology ?? official?.numerology ?? null,
      planet: user?.planet ?? official?.planet ?? null,
      zodiac: user?.zodiac ?? official?.zodiac ?? null,
      house: user?.house ?? official?.house ?? null,
      element: user?.element ?? official?.element ?? null,
      uprightMeaning: user?.uprightMeaning ?? official?.uprightMeaning ?? '',
      reversedMeaning: user?.reversedMeaning ?? official?.reversedMeaning ?? '',
      keywords: user?.keywords ?? official?.keywords ?? [],
      personalNotes: user?.personalNotes ?? '',
      personalMeaning: user?.personalMeaning,
      createdAt: user?.createdAt ?? new Date().toISOString(),
      updatedAt: user?.updatedAt ?? new Date().toISOString(),
    };

    return merged;
  }

  public getAllMergedAnnotations(): CardAnnotation[] {
    return OFFICIAL_CARD_ANNOTATIONS.map(official => this.mergeAnnotation(official.cardId, official));
  }

  public hasUserModification(cardId: string): boolean {
    return !!this.getUserAnnotation(cardId);
  }

  public getModifiedCardIds(): string[] {
    const userData = this.getUserData();
    return Object.keys(userData.annotations).filter(id => !userData.annotations[id].deletedAt);
  }

  public exportUserData(): string {
    const userData = this.getUserData();
    return JSON.stringify(userData, null, 2);
  }

  public importUserData(jsonString: string): boolean {
    try {
      const importedData = JSON.parse(jsonString) as UserAnnotationData;
      
      if (!importedData.annotations || typeof importedData.annotations !== 'object') {
        throw new Error('Invalid data format');
      }

      const currentData = this.getUserData();
      
      const mergedAnnotations = { ...currentData.annotations };
      for (const [cardId, annotation] of Object.entries(importedData.annotations)) {
        const existing = mergedAnnotations[cardId];
        mergedAnnotations[cardId] = {
          ...(existing?.deletedAt ? {} : existing),
          ...annotation as Partial<CardAnnotation>,
          cardId,
          userId: currentData.userId,
          updatedAt: new Date(Math.max(Date.now(), new Date(existing?.updatedAt || 0).getTime() + 1)).toISOString(),
        };
      }

      const newData: UserAnnotationData = {
        userId: currentData.userId,
        annotations: mergedAnnotations,
        version: CURRENT_VERSION,
        lastUpdated: new Date().toISOString()
      };

      this.saveUserData(newData);
      return true;
    } catch (error) {
      console.error('Failed to import user data:', error);
      return false;
    }
  }

  public clearAllUserData(): void {
    removeJsonWithBackup(this.storageKey);
    this.cache = null;
    this.notify();
  }

  public async sync() {
    const scope = this.scope;
    if (scope === 'guest') return;
    this.setScope(scope);
    const { getCardAnnotations, syncUserAnnotations } = await import('../lib/firebaseData');
    const legacyMeanings = await getCardAnnotations(scope);
    if (this.scope !== scope) return;
    const current = this.getUserData();
    const incoming = { ...current.annotations };
    for (const card of TAROT_CARDS) {
      if (legacyMeanings[card.name] && !incoming[card.id]?.deletedAt && incoming[card.id]?.personalMeaning === undefined) {
        incoming[card.id] = { ...incoming[card.id], cardId: card.id, userId: scope, personalMeaning: legacyMeanings[card.name], updatedAt: incoming[card.id]?.updatedAt || '1970-01-01T00:00:00.000Z' };
      }
    }
    const merged = await syncUserAnnotations(scope, Object.values(incoming));
    if (this.scope !== scope) return;
    // Edits made while a request was in flight always stay in the local copy.
    const latest = this.getUserData();
    const annotations = { ...latest.annotations };
    for (const entry of merged) {
      if (!entry.cardId) continue;
      const local = annotations[entry.cardId];
      if (!local || (entry.updatedAt || '') >= (local.updatedAt || '')) annotations[entry.cardId] = entry;
    }
    if (JSON.stringify(annotations) !== JSON.stringify(latest.annotations)) this.saveUserData({ ...latest, annotations });
  }
}

export const cardAnnotationService = new CardAnnotationService();
