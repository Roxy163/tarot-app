import { readLocalDraft } from '../hooks/useLocalDraft';
import type { ReadingEditorDraft, TarotReading } from '../types';

export function findResumableReading(scope: string, readings: TarotReading[]) {
  const ids = ['new', ...readings.filter(reading => !reading.isExample).map(reading => reading.id)];
  return ids.flatMap(id => {
    const draft = readLocalDraft<ReadingEditorDraft>(`tarot_reading_draft_${scope}_${id}`);
    if (!draft?.formData || !Array.isArray(draft.cardSlots) || draft.hasUnsavedChanges === false) return [];
    const filled = draft.cardSlots.filter(slot => typeof slot?.name === 'string' && slot.name.trim()).length;
    const question = typeof draft.formData.question === 'string' ? draft.formData.question.trim() : '';
    const notes = [draft.formData.singleCard, draft.formData.combination, draft.formData.userFeedback, draft.formData.aiAnswer,
      draft.formData.clientFeedback, draft.formData.numerologyInfluence, draft.formData.astrologyInfluence,
      draft.formData.houseInfluence, draft.formData.elementInfluence, draft.formData.choicePathA, draft.formData.choicePathB,
      ...(Array.isArray(draft.cardInterpretations) ? draft.cardInterpretations : []), ...(Array.isArray(draft.cardQuestions) ? draft.cardQuestions : [])];
    if (!filled && (!question || question === '今日抽牌记录') && !notes.some(note => typeof note === 'string' && note.trim())) return [];
    const updated = Date.parse(draft.updatedAt || '');
    return [{ id, question: question || '未完成的手记', filled, total: draft.cardSlots.length, updated: Number.isFinite(updated) ? updated : 0 }];
  }).sort((a, b) => b.updated - a.updated)[0] || null;
}
