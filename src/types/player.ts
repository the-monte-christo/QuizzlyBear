// Register der Handy-Komponenten je Fragetyp.
import type { Component } from 'svelte';
import type { QuestionType } from '../shared/quiz';
import type { PlayerProps } from './ui';
import Circle from './circle/Player.svelte';
import Estimate from './estimate/Player.svelte';
import Interval from './interval/Player.svelte';
import Match from './match/Player.svelte';
import Mcma from './mcma/Player.svelte';
import Mcsa from './mcsa/Player.svelte';
import Order from './order/Player.svelte';
import Pin from './pin/Player.svelte';
import Poll from './poll/Player.svelte';

export const PLAYER_UI: Record<QuestionType, Component<PlayerProps>> = {
  mcsa: Mcsa,
  mcma: Mcma,
  order: Order,
  match: Match,
  estimate: Estimate,
  interval: Interval,
  pin: Pin,
  circle: Circle,
  poll: Poll,
};
