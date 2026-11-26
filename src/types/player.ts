// Register der Handy-Komponenten je Fragetyp.
import type { Component } from 'svelte';
import type { QuestionType } from '../shared/quiz';
import type { PlayerProps } from './ui';
import Mcsa from './mcsa/Player.svelte';

export const PLAYER_UI: Partial<Record<QuestionType, Component<PlayerProps>>> = {
  mcsa: Mcsa,
};
