import '@fontsource-variable/fredoka';
import '../lib/base.css';
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
