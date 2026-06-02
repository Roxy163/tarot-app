import { CardAnnotation, UserAnnotationData } from '../types';
import { OFFICIAL_CARD_ANNOTATIONS, getAnnotationByCardId } from '../constants/cardAnnotations';

const STORAGE_KEY = 'tarot_user_annotations';
const CURRENT_VERSION = 1;

class CardAnnotationService {
  private cache: UserAnnotationData | null = null;

  private getUserId(): string {
    const storedUserId = localStorage.getItem('tarot_user_id');
    if (!storedUserId) {
      const newUserId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('tarot_user_id', newUserId);
      return newUserId;
    }
    return storedUserId;
  }

  private getUserData(): UserAnnotationData {
    if (this.cache) {
      return this.cache;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored) as UserAnnotationData;
        this.cache = data;
        return data;
      } catch (error) {
        console.error('Failed to parse user annotation data:', error);
      }
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    this.cache = data;
  }

  public getUserAnnotation(cardId: string): Partial<CardAnnotation> | null {
    const userData = this.getUserData();
    return userData.annotations[cardId] || null;
  }

  public getAllUserAnnotations(): Record<string, Partial<CardAnnotation>> {
    const userData = this.getUserData();
    return userData.annotations;
  }

  public saveUserAnnotation(cardId: string, annotation: Partial<CardAnnotation>): void {
    const userData = this.getUserData();
    
    const existingAnnotation = userData.annotations[cardId] || {};
    const updatedAnnotation: Partial<CardAnnotation> = {
      ...existingAnnotation,
      ...annotation,
      cardId,
      userId: userData.userId,
      updatedAt: new Date().toISOString(),
    };

    if (!existingAnnotation.createdAt) {
      updatedAnnotation.createdAt = new Date().toISOString();
    }

    userData.annotations[cardId] = updatedAnnotation;
    this.saveUserData(userData);
  }

  public deleteUserAnnotation(cardId: string): void {
    const userData = this.getUserData();
    delete userData.annotations[cardId];
    this.saveUserData(userData);
  }

  public resetAnnotationToOfficial(cardId: string): void {
    const userData = this.getUserData();
    delete userData.annotations[cardId];
    this.saveUserData(userData);
  }

  public getMergedAnnotation(cardId: string): CardAnnotation {
    const official = getAnnotationByCardId(cardId);
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
      createdAt: user?.createdAt ?? new Date().toISOString(),
      updatedAt: user?.updatedAt ?? new Date().toISOString(),
    };

    return merged;
  }

  public getAllMergedAnnotations(): CardAnnotation[] {
    return OFFICIAL_CARD_ANNOTATIONS.map(official => {
      const cardId = official.cardId;
      const user = this.getUserAnnotation(cardId);

      return {
        cardId,
        userId: this.getUserId(),
        numerology: user?.numerology ?? official.numerology,
        planet: user?.planet ?? official.planet,
        zodiac: user?.zodiac ?? official.zodiac,
        house: user?.house ?? official.house,
        element: user?.element ?? official.element,
        uprightMeaning: user?.uprightMeaning ?? official.uprightMeaning,
        reversedMeaning: user?.reversedMeaning ?? official.reversedMeaning,
        keywords: user?.keywords ?? official.keywords,
        personalNotes: user?.personalNotes ?? '',
        createdAt: user?.createdAt ?? new Date().toISOString(),
        updatedAt: user?.updatedAt ?? new Date().toISOString(),
      };
    });
  }

  public hasUserModification(cardId: string): boolean {
    return !!this.getUserAnnotation(cardId);
  }

  public getModifiedCardIds(): string[] {
    const userData = this.getUserData();
    return Object.keys(userData.annotations);
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
        mergedAnnotations[cardId] = {
          ...mergedAnnotations[cardId],
          ...annotation as Partial<CardAnnotation>,
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
    localStorage.removeItem(STORAGE_KEY);
    this.cache = null;
  }
}

export const cardAnnotationService = new CardAnnotationService();
