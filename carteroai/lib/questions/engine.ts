import { QUESTION_GROUPS } from './bank';
import type { AnswerMap, QuestionDef, QuestionGroup } from './types';

/** Devuelve solo las preguntas visibles de un grupo dadas las respuestas actuales. */
export function visibleQuestions(group: QuestionGroup, answers: AnswerMap): QuestionDef[] {
  return group.questions.filter((q) => !q.condition || q.condition(answers));
}

/** Todos los grupos con al menos una pregunta visible, en orden. Determina el nº total de pantallas. */
export function visibleGroups(answers: AnswerMap): QuestionGroup[] {
  return QUESTION_GROUPS.filter((g) => visibleQuestions(g, answers).length > 0);
}

export function isGroupComplete(group: QuestionGroup, answers: AnswerMap): boolean {
  return visibleQuestions(group, answers).every((q) => {
    if (!q.required) return true;
    const v = answers[q.id];
    if (v === undefined || v === null) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    if (Array.isArray(v)) return true; // multi-choice opcional por selección vacía permitida si no required estrictamente
    return true;
  });
}

export function progress(answers: AnswerMap, currentGroupId: string): { currentIndex: number; total: number } {
  const groups = visibleGroups(answers);
  const idx = groups.findIndex((g) => g.id === currentGroupId);
  return { currentIndex: idx === -1 ? 0 : idx, total: groups.length };
}
