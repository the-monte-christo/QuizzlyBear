<script lang="ts">
  import { onMount } from 'svelte';
  import Backdrop from '../lib/Backdrop.svelte';
  import Icon from '../lib/Icon.svelte';
  import Sticker from '../lib/Sticker.svelte';
  import { TYPE_LABELS } from '../../types/labels';
  import type { QuestionType } from '../../shared/quiz';
  import { api, ApiError, type GameSummary, type ImportError, type QuizSummary, type User } from './api';

  let user = $state<User | null>(null);
  let loading = $state(true);
  let quizzes = $state<QuizSummary[]>([]);
  let games = $state<GameSummary[]>([]);
  let users = $state<User[]>([]);
  let notice = $state('');

  // Login
  let loginName = $state('');
  let loginPass = $state('');
  let loginError = $state('');

  // Upload
  let uploading = $state(false);
  let dragOver = $state(false);
  let uploadError = $state('');
  let uploadErrors = $state<ImportError[]>([]);
  let fileInput = $state<HTMLInputElement>();

  // Konto / Benutzer
  let pwCurrent = $state('');
  let pwNext = $state('');
  let newName = $state('');
  let newPass = $state('');
  let newAdmin = $state(false);
  let accountMsg = $state('');

  const PHASES: Record<string, string> = {
    lobby: 'Lobby',
    countdown: 'läuft',
    question: 'läuft',
    locked: 'läuft',
    reveal: 'läuft',
    leaderboard: 'läuft',
    final: 'beendet',
  };

  onMount(async () => {
    try {
      user = (await api('/auth/me')).user;
      if (user) await refresh();
    } finally {
      loading = false;
    }
  });

  async function refresh() {
    const [q, g] = await Promise.all([api('/quizzes'), api('/games')]);
    quizzes = q.quizzes;
    games = g.games;
    if (user?.admin) users = (await api('/users')).users;
  }

  async function login(e: SubmitEvent) {
    e.preventDefault();
    loginError = '';
    try {
      user = (await api('/auth/login', { method: 'POST', json: { name: loginName, password: loginPass } })).user;
      loginPass = '';
      await refresh();
    } catch (err) {
      loginError = (err as Error).message;
    }
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    user = null;
  }

  function openHost(g: { pin: string; hostKey: string }) {
    localStorage.setItem(`qb:host:${g.pin}`, g.hostKey);
    location.href = `/host/?pin=${g.pin}`;
  }

  async function start(quiz: QuizSummary) {
    try {
      openHost(await api<GameSummary>('/games', { method: 'POST', json: { quizId: quiz.id } }));
    } catch (err) {
      notice = (err as Error).message;
    }
  }

  async function endGame(g: GameSummary) {
    if (!confirm(`Spiel ${g.pin} („${g.title}“) wirklich beenden? Alle Spieler fliegen raus.`)) return;
    await api(`/games/${g.pin}`, { method: 'DELETE' });
    await refresh();
  }

  async function removeQuiz(quiz: QuizSummary) {
    if (!confirm(`Quiz „${quiz.title}“ wirklich löschen?`)) return;
    await api(`/quizzes/${quiz.id}`, { method: 'DELETE' });
    await refresh();
  }

  async function upload(file: File | undefined, replaceId?: number) {
    if (!file) return;
    uploading = true;
    uploadError = '';
    uploadErrors = [];
    notice = '';
    try {
      const isZip = /\.zip$/i.test(file.name) || file.type.includes('zip');
      const res = await api<{ id: number; title: string; questions: number; warnings: string[] }>(
        replaceId ? `/quizzes/${replaceId}` : '/quizzes',
        {
          method: replaceId ? 'PUT' : 'POST',
          headers: { 'Content-Type': isZip ? 'application/zip' : 'application/json' },
          body: file,
        },
      );
      notice = `„${res.title}“ mit ${res.questions} Fragen gespeichert.` + (res.warnings.length ? ` Hinweise: ${res.warnings.join(' ')}` : '');
      await refresh();
    } catch (err) {
      uploadError = (err as Error).message;
      uploadErrors = err instanceof ApiError ? (err.errors ?? []) : [];
    } finally {
      uploading = false;
      if (fileInput) fileInput.value = '';
    }
  }

  function ondrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    upload(e.dataTransfer?.files[0]);
  }

  async function changePassword(e: SubmitEvent) {
    e.preventDefault();
    accountMsg = '';
    try {
      await api('/auth/password', { method: 'POST', json: { current: pwCurrent, next: pwNext } });
      pwCurrent = pwNext = '';
      accountMsg = 'Passwort geändert.';
    } catch (err) {
      accountMsg = (err as Error).message;
    }
  }

  async function addUser(e: SubmitEvent) {
    e.preventDefault();
    accountMsg = '';
    try {
      await api('/users', { method: 'POST', json: { name: newName, password: newPass, admin: newAdmin } });
      accountMsg = `Quizmaster „${newName}“ angelegt.`;
      newName = newPass = '';
      newAdmin = false;
      await refresh();
    } catch (err) {
      accountMsg = (err as Error).message;
    }
  }

  async function removeUser(u: User) {
    if (!confirm(`Quizmaster „${u.name}“ samt allen Quizzen löschen?`)) return;
    await api(`/users/${u.id}`, { method: 'DELETE' });
    await refresh();
  }

  const date = (ms: number) => new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
</script>

<Backdrop variant="phone" deco={false} />

<div class="page">
  <header class="top">
    <a class="brand" href="/admin/">
      <img src="/art/bear-head-s.webp" alt="" />
      <span>Quizzly<b>Bear</b></span>
      <small>Quizmaster</small>
    </a>
    {#if user}
      <div class="who">
        <span class="pill">{user.name}{user.admin ? ' · Admin' : ''}</span>
        <button class="btn plain small" onclick={logout}>Abmelden</button>
      </div>
    {/if}
  </header>

  {#if loading}
    <p class="center">Lade …</p>
  {:else if !user}
    <div class="login-wrap">
      <Sticker name="bear-wave" small class="bob" />
      <form class="card login" onsubmit={login}>
        <h1>Quizmaster-Login</h1>
        <label><span>Name</span><input class="field" autocomplete="username" bind:value={loginName} /></label>
        <label><span>Passwort</span><input class="field" type="password" autocomplete="current-password" bind:value={loginPass} /></label>
        {#if loginError}<p class="error" role="alert">{loginError}</p>{/if}
        <button class="btn" disabled={!loginName || !loginPass}>Anmelden</button>
      </form>
      <p class="hint">Du willst nur mitspielen? <a href="/">Hier geht's zum Spiel.</a></p>
    </div>
  {:else}
    {#if notice}<p class="notice card" role="status">{notice}</p>{/if}

    {#if games.length}
      <section>
        <h2>Laufende Spiele</h2>
        <div class="list">
          {#each games as g (g.pin)}
            <div class="card item">
              <div class="info">
                <h3>{g.title}</h3>
                <p>PIN <b>{g.pin}</b> · {PHASES[g.phase] ?? g.phase} · {g.players} Spieler</p>
              </div>
              <div class="actions">
                <button class="btn small honey" onclick={() => openHost(g)}><Icon name="expand" /> Host-Screen</button>
                <button class="btn small plain" onclick={() => endGame(g)}>Beenden</button>
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <section>
      <h2>Quizze</h2>
      {#if quizzes.length === 0}
        <p class="empty card">Noch kein Quiz da. Lade unten eine <code>quiz.json</code> oder ein ZIP hoch.</p>
      {/if}
      <div class="list">
        {#each quizzes as quiz (quiz.id)}
          <div class="card item">
            <div class="info">
              <h3>{quiz.title}</h3>
              {#if quiz.description}<p>{quiz.description}</p>{/if}
              <p class="meta">
                {quiz.questions} Fragen · geändert {date(quiz.updatedAt)}{quiz.owner !== user.name ? ` · von ${quiz.owner}` : ''}
              </p>
              <p class="chips">
                {#each quiz.types as t (t)}<span class="chip">{TYPE_LABELS[t as QuestionType]?.label ?? t}</span>{/each}
              </p>
            </div>
            <div class="actions">
              <button class="btn" onclick={() => start(quiz)}><Icon name="play" /> Spiel starten</button>
              <a class="btn small plain" href="/api/quizzes/{quiz.id}/export" download>JSON</a>
              <button class="btn small plain" title="Löschen" aria-label="Quiz löschen" onclick={() => removeQuiz(quiz)}><Icon name="trash" /></button>
            </div>
          </div>
        {/each}
      </div>
    </section>

    <section>
      <h2>Quiz hochladen</h2>
      <div
        class="drop card"
        class:over={dragOver}
        role="group"
        aria-label="Quiz-Datei hochladen"
        ondragover={(e) => {
          e.preventDefault();
          dragOver = true;
        }}
        ondragleave={() => (dragOver = false)}
        {ondrop}
      >
        <Icon name="upload" />
        <p><b>ZIP</b> (quiz.json + Ordner img/) oder reine <b>quiz.json</b> mit Bild-URLs hierher ziehen</p>
        <button class="btn honey" disabled={uploading} onclick={() => fileInput?.click()}>{uploading ? 'Verarbeite …' : 'Datei wählen'}</button>
        <input bind:this={fileInput} type="file" accept=".zip,.json,application/zip,application/json" hidden onchange={(e) => upload(e.currentTarget.files?.[0])} />
      </div>
      {#if uploadError}
        <div class="card errors" role="alert">
          <h3><Icon name="cross" /> {uploadError}</h3>
          {#if uploadErrors.length}
            <ul>
              {#each uploadErrors as e, i (i)}
                <li><code>{e.path}</code> {e.message}</li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}
      <p class="docs">
        Format: <a href="/schema/quiz-format.md" target="_blank" rel="noopener">Beschreibung (auch als Vorlage für eine KI)</a> ·
        <a href="/schema/quiz.schema.json" target="_blank" rel="noopener">JSON-Schema</a> ·
        <a href="/schema/beispiel-quiz.json" target="_blank" rel="noopener">Beispiel-Quiz</a>
      </p>
    </section>

    <section class="account">
      <h2>Konto</h2>
      <div class="cols">
        <form class="card form" onsubmit={changePassword}>
          <h3>Passwort ändern</h3>
          <input class="field" type="password" placeholder="Aktuelles Passwort" autocomplete="current-password" bind:value={pwCurrent} />
          <input class="field" type="password" placeholder="Neues Passwort (mind. 8 Zeichen)" autocomplete="new-password" bind:value={pwNext} />
          <button class="btn small" disabled={!pwCurrent || pwNext.length < 8}>Speichern</button>
        </form>
        {#if user.admin}
          <form class="card form" onsubmit={addUser}>
            <h3>Quizmaster anlegen</h3>
            <input class="field" placeholder="Name" autocomplete="off" bind:value={newName} />
            <input class="field" type="password" placeholder="Passwort (mind. 8 Zeichen)" autocomplete="new-password" bind:value={newPass} />
            <label class="check"><input type="checkbox" bind:checked={newAdmin} /> Admin-Rechte</label>
            <button class="btn small" disabled={newName.length < 2 || newPass.length < 8}>Anlegen</button>
          </form>
          <div class="card form">
            <h3>Quizmaster</h3>
            {#each users as u (u.id)}
              <div class="urow">
                <span>{u.name}{u.admin ? ' · Admin' : ''}</span>
                {#if u.id !== user.id}
                  <button class="btn small plain" aria-label="{u.name} löschen" onclick={() => removeUser(u)}><Icon name="trash" /></button>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
      {#if accountMsg}<p class="notice card" role="status">{accountMsg}</p>{/if}
    </section>
  {/if}
</div>

<style>
  :global(body) {
    overflow-y: auto;
  }
  .page {
    max-width: 62rem;
    margin: 0 auto;
    padding: 1rem 1.2rem 4rem;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.7rem;
    font-weight: 700;
    color: var(--ink);
    text-decoration: none;
    transform: rotate(-1.5deg);
  }
  .brand img {
    width: 3rem;
  }
  .brand b {
    color: var(--a1);
  }
  .brand small {
    font-size: 0.9rem;
    font-weight: 600;
    padding: 0.1rem 0.6rem;
    border-radius: 99rem;
    background: var(--ink);
    color: #fff;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  section {
    margin-top: 2rem;
  }
  h2 {
    font-size: 1.6rem;
    font-weight: 700;
    margin-bottom: 0.8rem;
  }
  h3 {
    font-size: 1.25rem;
    font-weight: 700;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.2rem;
  }
  .item:nth-child(odd) {
    transform: rotate(-0.25deg);
  }
  .item:nth-child(even) {
    transform: rotate(0.25deg);
  }
  .info {
    flex: 1 1 18rem;
    min-width: 0;
  }
  .info p {
    color: var(--ink-2);
  }
  .meta {
    font-size: 0.92rem;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.4rem;
  }
  .chip {
    padding: 0.05rem 0.6rem;
    border: 0.1rem solid var(--ink);
    border-radius: 99rem;
    background: var(--cream);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--ink);
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .actions a {
    text-decoration: none;
  }
  .empty,
  .notice {
    padding: 0.9rem 1.1rem;
    font-weight: 600;
  }
  .notice {
    background: var(--ok-bg);
    border-color: var(--ok);
    margin-bottom: 1rem;
  }
  .drop {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.8rem;
    padding: 1.6rem 1rem;
    border-style: dashed;
    text-align: center;
    font-size: 1.05rem;
  }
  .drop :global(.icon) {
    font-size: 2.2rem;
  }
  .drop.over {
    background: var(--honey-light);
    transform: scale(1.01);
  }
  .errors {
    margin-top: 1rem;
    padding: 1rem 1.2rem;
    background: var(--bad-bg);
    border-color: var(--bad);
  }
  .errors h3 {
    color: var(--bad);
  }
  .errors ul {
    margin: 0.6rem 0 0;
    padding-left: 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  code {
    font-family: ui-monospace, Consolas, monospace;
    font-size: 0.9em;
    padding: 0.05rem 0.35rem;
    border-radius: 0.35rem;
    background: rgba(46, 26, 11, 0.1);
  }
  .docs {
    margin-top: 0.8rem;
    font-weight: 600;
  }
  a {
    color: var(--a0);
  }
  .cols {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: 1rem;
    align-items: start;
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 1rem;
  }
  .form .field {
    font-size: 1rem;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
  }
  .urow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 600;
  }
  .login-wrap {
    max-width: 24rem;
    margin: 2rem auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  .login-wrap :global(.sticker) {
    width: 9rem;
  }
  .login {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    padding: 1.3rem;
  }
  .login h1 {
    font-size: 1.6rem;
  }
  .login label span {
    display: block;
    font-weight: 650;
    margin-bottom: 0.2rem;
  }
  .error {
    padding: 0.5rem 0.8rem;
    border: var(--line) solid var(--bad);
    border-radius: var(--r-s);
    background: var(--bad-bg);
    color: var(--bad);
    font-weight: 600;
  }
  .hint,
  .center {
    text-align: center;
    font-weight: 600;
  }
</style>
