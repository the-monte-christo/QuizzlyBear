// Register der Host-Komponenten je Fragetyp.
import type { Component } from 'svelte';
import type { QuestionType } from '../shared/quiz';
import type { HostProps } from './ui';
import Mcsa from './mcsa/Host.svelte';

export const HOST_UI: Partial<Record<QuestionType, Component<HostProps>>> = {
  mcsa: Mcsa,
};
