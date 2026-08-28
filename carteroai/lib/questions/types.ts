export type QuestionType = 'single_choice' | 'multi_choice' | 'number' | 'text' | 'boolean';

export interface QuestionOption {
  value: string;
  label: string;
  helpText?: string;
}

export type AnswerValue = string | string[] | number | boolean | undefined;
export type AnswerMap = Record<string, AnswerValue>;

export interface QuestionDef {
  id: string;
  type: QuestionType;
  title: string;
  helpText?: string;
  options?: QuestionOption[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  required: boolean;
  /** Si se define, la pregunta solo se muestra cuando devuelve true. */
  condition?: (answers: AnswerMap) => boolean;
}

export interface QuestionGroup {
  id: string;
  title: string;
  subtitle: string;
  questions: QuestionDef[];
}
