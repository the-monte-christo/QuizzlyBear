// Register aller Fragetypen (nur Logik – ohne UI, damit der Server es laden kann).
import type { QuestionType } from '../shared/quiz';
import type { TypeLogic } from './logic';
import { mcsa } from './mcsa/logic';

export const TYPES: Partial<Record<QuestionType, TypeLogic>> = {
  mcsa,
};

export function logicFor(type: string): TypeLogic | undefined {
  return (TYPES as Record<string, TypeLogic | undefined>)[type];
}

export type { TypeLogic } from './logic';
