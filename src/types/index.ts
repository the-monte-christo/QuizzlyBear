// Register aller Fragetypen (nur Logik – ohne UI, damit der Server es laden kann).
import type { QuestionType } from '../shared/quiz';
import type { TypeLogic } from './logic';
import { circle } from './circle/logic';
import { estimate } from './estimate/logic';
import { interval } from './interval/logic';
import { match } from './match/logic';
import { mcma } from './mcma/logic';
import { mcsa } from './mcsa/logic';
import { order } from './order/logic';
import { pin } from './pin/logic';
import { poll } from './poll/logic';

export const TYPES: Partial<Record<QuestionType, TypeLogic>> = {
  mcsa,
  mcma,
  order,
  match,
  estimate,
  interval,
  pin,
  circle,
  poll,
};

export function logicFor(type: string): TypeLogic | undefined {
  return (TYPES as Record<string, TypeLogic | undefined>)[type];
}

export type { TypeLogic } from './logic';
