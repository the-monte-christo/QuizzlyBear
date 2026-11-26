// Register der Host-Komponenten je Fragetyp.
import type { Component } from 'svelte';
import type { QuestionType } from '../shared/quiz';
import type { HostProps } from './ui';
import Circle from './circle/Host.svelte';
import Estimate from './estimate/Host.svelte';
import Interval from './interval/Host.svelte';
import Match from './match/Host.svelte';
import Mcma from './mcma/Host.svelte';
import Mcsa from './mcsa/Host.svelte';
import Order from './order/Host.svelte';
import Pin from './pin/Host.svelte';
import Poll from './poll/Host.svelte';

export const HOST_UI: Record<QuestionType, Component<HostProps>> = {
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
