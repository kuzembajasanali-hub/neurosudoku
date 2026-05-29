const SIZE = 9;
const BOX = 3;
const EMPTY = 0;
const STORAGE_KEY = "neurosudoku-state-v2";
const API_BASE =
  window.location.port === "5173" ? "http://127.0.0.1:5174" : window.location.origin;

const solvedTemplate = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

const modes = {
  focus: { label: "Morning Focus", blanks: 38, hints: 5, xp: 100 },
  speed: { label: "Speed Arena", blanks: 44, hints: 3, xp: 140 },
  pro: { label: "Pro Logic", blanks: 52, hints: 2, xp: 190 },
  kids: { label: "Kids Academy", blanks: 30, hints: 7, xp: 80 },
};

const lessons = [
  {
    title: "Naked single",
    text: "If a cell has only one possible candidate after checking row, column and box, it is a safe move.",
    task: "Select an empty cell and ask AI Coach to calculate candidates.",
  },
  {
    title: "Hidden single",
    text: "Sometimes a number has several candidates globally, but only one possible place inside a row, column or box.",
    task: "Use notes mode, then compare candidates in one 3x3 box.",
  },
  {
    title: "Box-line reduction",
    text: "If candidates for a number inside a box all sit on one row or column, that number can be removed from the rest of that line.",
    task: "Open Pro Logic and use the coach before taking a hint.",
  },
];

const cityPool = [
  ["Aruzhan", "Almaty"],
  ["Miras", "Astana"],
  ["Dana", "Shymkent"],
  ["Timur", "Kyzylorda"],
  ["Sofia", "Almaty"],
  ["Ayan", "Karaganda"],
  ["Adil", "Atyrau"],
];

const app = document.querySelector("#app");
let state = loadState();
if (!state) {
  state = createGame("focus", "play");
}
let timerId = null;
let toastId = null;

render();
startTimer();
syncBackend();
document.addEventListener("keydown", onKeyDown);

function createGame(mode = "focus", view = state?.view || "play", seed = `${mode}-${Date.now()}`) {
  const rng = mulberry32(hashString(seed));
  const solved = shuffleSolved(rng);
  return {
    view,
    mode,
    seed,
    theme: state?.theme || "light",
    profile: state?.profile || {
      name: "Player",
      city: "Almaty",
      pro: false,
      email: "player@neurosudoku.app",
    },
    puzzle: makePuzzle(solved, modes[mode].blanks, rng),
    solved,
    entries: blankGrid(),
    notes: Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => [])),
    selected: [0, 0],
    noteMode: false,
    elapsed: 0,
    mistakes: 0,
    hintsUsed: 0,
    completed: false,
    lastHint: null,
    coach:
      "Select a cell and press AI Coach. It will explain candidates, conflicts and the next logical move.",
    stats: state?.stats || {
      games: 0,
      wins: 0,
      streak: 0,
      xp: 0,
      bestTime: null,
      dailyDone: "",
      academyDone: 1,
    },
    history: state?.history || [],
    backend: state?.backend || {
      online: false,
      message: "LocalStorage mode",
      leaderboard: [],
    },
  };
}

function render() {
  document.documentElement.dataset.theme = state.theme;
  const activeValue = getSelectedValue();
  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <div class="brand">
          <div class="mark">9</div>
          <div>
            <h1>NeuroSudoku</h1>
            <p>Daily Sudoku, AI coaching, city rankings and Pro monetization.</p>
          </div>
        </div>
        <nav class="nav-tabs" aria-label="Product navigation">
          ${["play", "daily", "learn", "leaderboard", "profile", "pro"]
            .map((view) => `<button class="nav-tab ${state.view === view ? "active" : ""}" data-view="${view}">${labelView(view)}</button>`)
            .join("")}
        </nav>
        <div class="top-actions">
          <button class="ghost" data-action="theme">${state.theme === "dark" ? "Light" : "Dark"}</button>
          <button class="button" data-view="pro">Upgrade Pro</button>
        </div>
      </header>
      ${renderView(activeValue)}
      <div class="toast hidden" id="toast"></div>
    </main>
  `;
  bindEvents();
}

function renderView(activeValue) {
  if (state.view === "daily") return renderDaily(activeValue);
  if (state.view === "learn") return renderLearn();
  if (state.view === "leaderboard") return renderLeaderboardPage();
  if (state.view === "profile") return renderProfile();
  if (state.view === "pro") return renderPro();
  return renderPlay(activeValue);
}

function renderPlay(activeValue) {
  return `
    <section class="layout">
      <div class="game-zone">
        ${renderProductHero("Startup prototype", "Sudoku that trains the brain, not just fills a grid", "Generated puzzles, notes, hint budgets, timer, speed scoring and AI explanations create a retention loop instead of a one-time game.")}
        ${renderBoard(activeValue)}
      </div>
      <aside class="side">
        ${renderCoachPanel()}
        ${renderStatsPanel()}
        ${renderMiniLeaderboard()}
        ${renderBackendPanel()}
      </aside>
    </section>
  `;
}

function renderDaily(activeValue) {
  const today = new Date().toISOString().slice(0, 10);
  return `
    <section class="layout">
      <div class="game-zone">
        ${renderProductHero("Daily Challenge", `One puzzle for everyone: ${today}`, "Players compete on time, mistakes and hints. In production this result would be stored in Supabase and shown on a public daily leaderboard.")}
        <div class="daily-actions">
          <button class="button" data-action="daily">Load today's puzzle</button>
          <button class="ghost" data-action="finishDaily">Simulate submit result</button>
        </div>
        ${renderBoard(activeValue)}
      </div>
      <aside class="side">
        <section class="panel">
          <h2>Daily rules</h2>
          <p>Score = base points minus time, mistakes and hints. This makes fast but inaccurate play less valuable.</p>
          <div class="stats-grid">
            <div class="stat-item"><strong>Today</strong><span>${today}</span></div>
            <div class="stat-item"><strong>Status</strong><span>${state.stats.dailyDone === today ? "Submitted" : "Open"}</span></div>
            <div class="stat-item"><strong>Your score</strong><span>${currentScore()}</span></div>
          </div>
        </section>
        ${renderMiniLeaderboard(true)}
        ${renderCoachPanel()}
      </aside>
    </section>
  `;
}

function renderLearn() {
  return `
    <section class="wide-page">
      ${renderProductHero("Sudoku Academy", "A learning mode for beginners and kids", "The product is not only a game. It teaches repeatable solving strategies and turns hints into lessons.")}
      <div class="lesson-grid">
        ${lessons
          .map(
            (lesson, index) => `
              <article class="lesson-card ${index < state.stats.academyDone ? "done" : ""}">
                <p class="eyebrow">Lesson ${index + 1}</p>
                <h2>${lesson.title}</h2>
                <p>${lesson.text}</p>
                <div class="coach-output">${lesson.task}</div>
                <button class="ghost" data-action="lesson" data-lesson="${index + 1}">${index < state.stats.academyDone ? "Completed" : "Mark complete"}</button>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderLeaderboardPage() {
  return `
    <section class="wide-page">
      ${renderProductHero("City leaderboard", `Top players from ${state.profile.city}`, "The social layer makes Sudoku competitive by city, school or company team.")}
      <div class="rank-grid">
        <section class="panel">
          <h2>Global ranking</h2>
          <div class="leader-list">${renderLeaderboard(false, 9)}</div>
        </section>
        <section class="panel">
          <h2>Market idea</h2>
          <p>City-based rankings are easy to understand and easy to share. This can later become school leagues, company wellness tournaments or branded morning challenges.</p>
          <div class="stats-grid">
            <div class="stat-item"><strong>Players online</strong><span>1,248</span></div>
            <div class="stat-item"><strong>City leagues</strong><span>17</span></div>
            <div class="stat-item"><strong>Daily retention</strong><span>42%</span></div>
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderProfile() {
  return `
    <section class="wide-page">
      ${renderProductHero("Player profile", "Local auth prototype with a Supabase-ready shape", "The UI already separates profile, city, email, XP, streak and saved progress.")}
      <div class="rank-grid">
        <section class="panel">
          <h2>Account</h2>
          <div class="profile-line">
            <input class="name-input" data-profile="name" value="${escapeHtml(state.profile.name)}" aria-label="Player name" />
            <select class="select" data-profile="city" aria-label="City">
              ${["Almaty", "Astana", "Shymkent", "Kyzylorda", "Karaganda", "Atyrau"]
                .map((city) => `<option ${city === state.profile.city ? "selected" : ""}>${city}</option>`)
                .join("")}
            </select>
          </div>
          <input class="name-input full-input" data-profile="email" value="${escapeHtml(state.profile.email)}" aria-label="Email" />
          <p>For the hackathon prototype this is stored in LocalStorage. Production path: Supabase Auth + profiles table.</p>
        </section>
        ${renderStatsPanel()}
      </div>
    </section>
  `;
}

function renderPro() {
  return `
    <section class="wide-page">
      ${renderProductHero("NeuroSudoku Pro", "A clear monetization path", "Premium skins, advanced AI coach, analytics and private tournaments turn the game into a startup prototype.")}
      <div class="pricing-grid">
        <article class="price-card">
          <p class="eyebrow">Free</p>
          <h2>Daily player</h2>
          <strong>$0</strong>
          <p>Generated puzzles, notes, basic AI Coach, local stats and daily challenge.</p>
          <button class="ghost" data-view="play">Keep playing</button>
        </article>
        <article class="price-card featured">
          <p class="eyebrow">Pro</p>
          <h2>Brain athlete</h2>
          <strong>$4.99/mo</strong>
          <p>Deep AI strategies, custom skins, city leagues, advanced analytics and private speed rooms.</p>
          <button class="button" data-action="pro">Activate prototype</button>
        </article>
        <article class="price-card">
          <p class="eyebrow">Teams</p>
          <h2>Schools and companies</h2>
          <strong>Custom</strong>
          <p>Weekly tournaments, admin dashboards and branded learning tracks.</p>
          <button class="ghost" data-action="teamLead">Request demo</button>
        </article>
      </div>
    </section>
  `;
}

function renderProductHero(eyebrow, title, text) {
  return `
    <div class="daily-panel product-hero">
      <p class="eyebrow">${eyebrow}</p>
      <h2>${title}</h2>
      <p>${text}</p>
      <div class="metric-row">
        <div class="metric"><span>Progress</span><strong>${Math.round((filledCount() / 81) * 100)}%</strong></div>
        <div class="metric"><span>Mode</span><strong>${modes[state.mode].label}</strong></div>
        <div class="metric"><span>Score</span><strong>${currentScore()}</strong></div>
      </div>
    </div>
  `;
}

function renderBoard(activeValue) {
  return `
    <div class="board-wrap">
      <div class="status-row">
        <div class="metric"><span>Time</span><strong>${formatTime(state.elapsed)}</strong></div>
        <div class="metric"><span>Mistakes</span><strong>${state.mistakes}</strong></div>
        <div class="metric"><span>Hints</span><strong>${state.hintsUsed}/${modes[state.mode].hints}</strong></div>
        <div class="metric"><span>Streak</span><strong>${state.stats.streak}</strong></div>
      </div>
      <div class="sudoku-board" role="grid" aria-label="Sudoku board">${renderCells(activeValue)}</div>
      <div class="controls">
        <div class="number-pad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9]
            .map((n) => `<button class="number-button ${activeValue === n ? "active" : ""}" data-number="${n}">${n}</button>`)
            .join("")}
          <button class="number-button" data-action="erase" title="Clear cell">C</button>
        </div>
        <div class="mode-row">
          <div class="tool-row">
            <label class="toggle"><input type="checkbox" data-action="notes" ${state.noteMode ? "checked" : ""}/> Notes</label>
            <button class="ghost" data-action="hint">Hint</button>
            <button class="ghost" data-action="coach">AI Coach</button>
            <button class="ghost" data-action="check">Check</button>
            <button class="ghost" data-action="new">New</button>
          </div>
          <select class="select" data-action="mode">
            ${Object.entries(modes)
              .map(([key, value]) => `<option value="${key}" ${state.mode === key ? "selected" : ""}>${value.label}</option>`)
              .join("")}
          </select>
        </div>
      </div>
    </div>
  `;
}

function renderCells(activeValue) {
  const [sr, sc] = state.selected;
  return Array.from({ length: SIZE * SIZE }, (_, index) => {
    const r = Math.floor(index / SIZE);
    const c = index % SIZE;
    const given = state.puzzle[r][c] !== EMPTY;
    const value = visibleValue(r, c);
    const classes = [
      "cell",
      given && "given",
      r === sr && c === sc && "selected",
      (r === sr || c === sc || sameBox(r, c, sr, sc)) && "peer",
      value && value === activeValue && "same",
      value && hasConflict(r, c, value) && "conflict",
      state.lastHint && state.lastHint[0] === r && state.lastHint[1] === c && "hint",
    ]
      .filter(Boolean)
      .join(" ");
    const content = value
      ? value
      : `<div class="notes-grid">${[1, 2, 3, 4, 5, 6, 7, 8, 9]
          .map((n) => `<span>${state.notes[r][c].includes(n) ? n : ""}</span>`)
          .join("")}</div>`;
    return `<button class="${classes}" data-cell="${r}-${c}" role="gridcell">${content}</button>`;
  }).join("");
}

function renderCoachPanel() {
  return `
    <section class="panel">
      <h2>AI Coach</h2>
      <div class="coach-output">${state.coach}</div>
      <button class="button" data-action="coach">Explain selected cell</button>
    </section>
  `;
}

function renderStatsPanel() {
  return `
    <section class="panel">
      <h2>Stats</h2>
      <div class="stats-grid">
        <div class="stat-item"><strong>Games</strong><span>${state.stats.games}</span></div>
        <div class="stat-item"><strong>Wins</strong><span>${state.stats.wins}</span></div>
        <div class="stat-item"><strong>Best time</strong><span>${state.stats.bestTime ? formatTime(state.stats.bestTime) : "none"}</span></div>
        <div class="stat-item"><strong>XP</strong><span>${state.stats.xp}</span></div>
      </div>
    </section>
  `;
}

function renderMiniLeaderboard(dailyOnly = false) {
  return `
    <section class="panel">
      <h2>${dailyOnly ? "Daily leaderboard" : "Leaderboard"}</h2>
      <div class="leader-list">${renderLeaderboard(dailyOnly, 5)}</div>
    </section>
  `;
}

function renderBackendPanel() {
  return `
    <section class="panel">
      <h2>Backend</h2>
      <div class="backend-status ${state.backend?.online ? "online" : "offline"}">
        <strong>${state.backend?.online ? "API online" : "Local fallback"}</strong>
        <span>${state.backend?.message || "LocalStorage mode"}</span>
      </div>
      <p>Node API saves profiles and attempts into a JSON database. Production path: Supabase Auth, tables and Stripe Checkout.</p>
    </section>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((el) => {
    el.addEventListener("click", () => {
      state.view = el.dataset.view;
      saveAndRender();
    });
  });

  document.querySelectorAll("[data-cell]").forEach((cell) => {
    cell.addEventListener("click", () => {
      state.selected = cell.dataset.cell.split("-").map(Number);
      saveAndRender();
    });
  });

  document.querySelectorAll("[data-number]").forEach((button) => {
    button.addEventListener("click", () => inputNumber(Number(button.dataset.number)));
  });

  document.querySelectorAll("[data-action]").forEach((el) => {
    const action = el.dataset.action;
    if (action === "mode") {
      el.addEventListener("change", () => {
        state = createGame(el.value, state.view);
        saveAndRender(`${modes[el.value].label} started.`);
      });
      return;
    }
    if (action === "notes") {
      el.addEventListener("change", () => {
        state.noteMode = el.checked;
        saveAndRender();
      });
      return;
    }
    el.addEventListener("click", () => handleAction(action, el));
  });

  document.querySelectorAll("[data-profile]").forEach((input) => {
    input.addEventListener("change", () => {
      state.profile[input.dataset.profile] = input.value.trim() || "Player";
      saveProfileToBackend();
      saveAndRender("Profile updated.");
    });
  });
}

function handleAction(action, el) {
  if (action === "theme") state.theme = state.theme === "dark" ? "light" : "dark";
  if (action === "pro") {
    state.profile.pro = true;
    showToast("Pro prototype activated. Stripe Checkout can be connected next.");
  }
  if (action === "teamLead") showToast("Demo request captured in the prototype funnel.");
  if (action === "daily") loadDaily();
  if (action === "finishDaily") submitDaily();
  if (action === "coach") coachSelectedCell();
  if (action === "hint") giveHint();
  if (action === "check") checkSolution();
  if (action === "new") state = createGame(state.mode, state.view);
  if (action === "erase") inputNumber(EMPTY);
  if (action === "lesson") {
    state.stats.academyDone = Math.max(state.stats.academyDone, Number(el.dataset.lesson) + 1);
    state.stats.xp += 15;
    showToast("Lesson completed. XP added.");
  }
  saveAndRender();
}

function inputNumber(number) {
  const [r, c] = state.selected;
  if (state.puzzle[r][c] !== EMPTY || state.completed) return;
  if (state.noteMode && number !== EMPTY) {
    const notes = new Set(state.notes[r][c]);
    notes.has(number) ? notes.delete(number) : notes.add(number);
    state.notes[r][c] = [...notes].sort();
  } else {
    state.entries[r][c] = number;
    state.notes[r][c] = [];
    if (number !== EMPTY && number !== state.solved[r][c]) state.mistakes += 1;
  }
  if (isComplete()) completeGame();
  saveAndRender();
}

function onKeyDown(event) {
  if (/^[1-9]$/.test(event.key)) inputNumber(Number(event.key));
  if (["Backspace", "Delete", "0"].includes(event.key)) inputNumber(EMPTY);
  if (event.key === "ArrowUp") moveSelection(-1, 0);
  if (event.key === "ArrowDown") moveSelection(1, 0);
  if (event.key === "ArrowLeft") moveSelection(0, -1);
  if (event.key === "ArrowRight") moveSelection(0, 1);
}

function moveSelection(dr, dc) {
  const [r, c] = state.selected;
  state.selected = [(r + dr + SIZE) % SIZE, (c + dc + SIZE) % SIZE];
  saveAndRender();
}

function loadDaily() {
  const today = new Date().toISOString().slice(0, 10);
  state = createGame("speed", "daily", `daily-${today}`);
  showToast("Today's shared puzzle loaded.");
}

function submitDaily() {
  const today = new Date().toISOString().slice(0, 10);
  state.stats.dailyDone = today;
  state.stats.xp += 20;
  const attempt = attemptPayload("daily");
  state.history.unshift({ date: today, score: attempt.score, time: state.elapsed });
  state.history = state.history.slice(0, 8);
  saveAttemptToBackend(attempt);
  showToast("Daily result submitted to the prototype leaderboard.");
}

function giveHint() {
  if (state.hintsUsed >= modes[state.mode].hints) {
    showToast("No hints left for this mode.");
    return;
  }
  const emptyCells = [];
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (state.puzzle[r][c] === EMPTY && state.entries[r][c] === EMPTY) emptyCells.push([r, c]);
    }
  }
  if (!emptyCells.length) return;
  const [r, c] = emptyCells[0];
  state.entries[r][c] = state.solved[r][c];
  state.hintsUsed += 1;
  state.lastHint = [r, c];
  state.coach = explainCell(r, c, state.solved[r][c], "Hint revealed");
  if (isComplete()) completeGame();
}

function coachSelectedCell() {
  const [r, c] = state.selected;
  if (state.puzzle[r][c] !== EMPTY) {
    state.coach = `<strong>Given cell R${r + 1}C${c + 1}</strong><br>This number is part of the puzzle seed and should be treated as a fixed anchor.`;
    return;
  }
  const value = state.entries[r][c] || state.solved[r][c];
  state.coach = explainCell(r, c, value, "AI Coach");
}

function explainCell(r, c, value, label) {
  const row = usedInRow(r);
  const col = usedInCol(c);
  const box = usedInBox(r, c);
  const candidates = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
    (n) => !row.has(n) && !col.has(n) && !box.has(n)
  );
  const strategy = candidates.length === 1 ? "naked single" : "candidate elimination";
  return `<strong>${label}: R${r + 1}C${c + 1}</strong><br>
    Row blocks ${formatSet(row)}. Column blocks ${formatSet(col)}. Box blocks ${formatSet(box)}.<br>
    Candidates: ${candidates.join(", ") || "none"}. Strategy: <strong>${strategy}</strong>. Best move: <strong>${value}</strong>.`;
}

function checkSolution() {
  const wrong = [];
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const value = visibleValue(r, c);
      if (value && value !== state.solved[r][c]) wrong.push(`R${r + 1}C${c + 1}`);
    }
  }
  showToast(wrong.length ? `Fix these cells: ${wrong.slice(0, 6).join(", ")}` : "All filled cells are correct.");
}

function completeGame() {
  if (state.completed) return;
  state.completed = true;
  state.stats.games += 1;
  state.stats.wins += 1;
  state.stats.streak += 1;
  state.stats.xp += Math.max(30, modes[state.mode].xp - state.mistakes * 9 - state.hintsUsed * 12);
  state.stats.bestTime = state.stats.bestTime === null ? state.elapsed : Math.min(state.stats.bestTime, state.elapsed);
  saveAttemptToBackend(attemptPayload("game"));
  showToast("Victory. Stats and XP updated.");
}

function renderLeaderboard(dailyOnly, limit) {
  if (state.backend?.leaderboard?.length) {
    return state.backend.leaderboard
      .slice(0, limit)
      .map(
        (player, index) => `
          <div class="leader-item">
            <strong>${index + 1}. ${escapeHtml(player.name)}</strong>
            <span>${player.city} · ${player.score}</span>
          </div>`
      )
      .join("");
  }

  const rng = mulberry32(hashString(`${state.seed}-${dailyOnly ? "daily" : "global"}`));
  return cityPool
    .map(([name, city], index) => ({
      name,
      city,
      score: 5200 - index * 330 - Math.floor(rng() * 220),
    }))
    .concat({ name: state.profile.name, city: state.profile.city, score: currentScore() })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(
      (player, index) => `
        <div class="leader-item">
          <strong>${index + 1}. ${escapeHtml(player.name)}</strong>
          <span>${player.city} · ${player.score}</span>
        </div>`
    )
    .join("");
}

function currentScore() {
  return Math.max(100, 3000 + state.stats.xp - state.elapsed * 2 - state.mistakes * 80 - state.hintsUsed * 120);
}

function attemptPayload(kind) {
  return {
    kind,
    email: state.profile.email,
    name: state.profile.name,
    city: state.profile.city,
    mode: state.mode,
    seed: state.seed,
    score: currentScore(),
    time: state.elapsed,
    mistakes: state.mistakes,
    hints: state.hintsUsed,
  };
}

async function syncBackend() {
  try {
    const health = await apiFetch("/api/health");
    const board = await apiFetch("/api/leaderboard");
    state.backend = {
      online: true,
      message: health.service,
      leaderboard: board.leaderboard || [],
    };
    await saveProfileToBackend(false);
    saveAndRender();
  } catch {
    state.backend = {
      online: false,
      message: "Start server.js to enable shared profile and leaderboard",
      leaderboard: [],
    };
    saveAndRender();
  }
}

async function saveProfileToBackend(renderAfter = true) {
  if (!state.backend?.online) return;
  try {
    await apiFetch("/api/profile", {
      method: "POST",
      body: JSON.stringify({
        ...state.profile,
        xp: state.stats.xp,
        streak: state.stats.streak,
        bestTime: state.stats.bestTime,
      }),
    });
    if (renderAfter) showToast("Profile synced to backend.");
  } catch {
    state.backend.online = false;
  }
}

async function saveAttemptToBackend(attempt) {
  if (!state.backend?.online) return;
  try {
    const result = await apiFetch("/api/attempts", {
      method: "POST",
      body: JSON.stringify(attempt),
    });
    state.backend.leaderboard = result.leaderboard || state.backend.leaderboard;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    state.backend.online = false;
  }
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json();
}

function filledCount() {
  let total = 0;
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (visibleValue(r, c)) total += 1;
    }
  }
  return total;
}

function isComplete() {
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (visibleValue(r, c) !== state.solved[r][c]) return false;
    }
  }
  return true;
}

function hasConflict(r, c, value) {
  for (let i = 0; i < SIZE; i += 1) {
    if (i !== c && visibleValue(r, i) === value) return true;
    if (i !== r && visibleValue(i, c) === value) return true;
  }
  const br = Math.floor(r / BOX) * BOX;
  const bc = Math.floor(c / BOX) * BOX;
  for (let rr = br; rr < br + BOX; rr += 1) {
    for (let cc = bc; cc < bc + BOX; cc += 1) {
      if ((rr !== r || cc !== c) && visibleValue(rr, cc) === value) return true;
    }
  }
  return false;
}

function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(() => {
    if (!state.completed && ["play", "daily"].includes(state.view)) {
      state.elapsed += 1;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      const timeNode = document.querySelector(".status-row .metric strong");
      if (timeNode) timeNode.textContent = formatTime(state.elapsed);
    }
  }, 1000);
}

function saveAndRender(message) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
  if (message) showToast(message);
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return parsed?.puzzle && parsed?.solved ? parsed : null;
  } catch {
    return null;
  }
}

function shuffleSolved(rng) {
  const bands = shuffle([0, 1, 2], rng);
  const stacks = shuffle([0, 1, 2], rng);
  const rows = bands.flatMap((band) => shuffle([0, 1, 2], rng).map((row) => band * BOX + row));
  const cols = stacks.flatMap((stack) => shuffle([0, 1, 2], rng).map((col) => stack * BOX + col));
  const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
  return rows.map((r) => cols.map((c) => nums[solvedTemplate[r][c] - 1]));
}

function makePuzzle(solution, blanks, rng) {
  const puzzle = solution.map((row) => [...row]);
  const cells = shuffle(
    Array.from({ length: SIZE * SIZE }, (_, i) => [Math.floor(i / SIZE), i % SIZE]),
    rng
  );
  for (const [r, c] of cells.slice(0, blanks)) puzzle[r][c] = EMPTY;
  return puzzle;
}

function visibleValue(r, c) {
  return state.puzzle[r][c] || state.entries[r][c];
}

function getSelectedValue() {
  const [r, c] = state.selected;
  return visibleValue(r, c);
}

function usedInRow(r) {
  return new Set(Array.from({ length: SIZE }, (_, c) => visibleValue(r, c)).filter(Boolean));
}

function usedInCol(c) {
  return new Set(Array.from({ length: SIZE }, (_, r) => visibleValue(r, c)).filter(Boolean));
}

function usedInBox(r, c) {
  const values = [];
  const br = Math.floor(r / BOX) * BOX;
  const bc = Math.floor(c / BOX) * BOX;
  for (let rr = br; rr < br + BOX; rr += 1) {
    for (let cc = bc; cc < bc + BOX; cc += 1) values.push(visibleValue(rr, cc));
  }
  return new Set(values.filter(Boolean));
}

function sameBox(a, b, c, d) {
  return Math.floor(a / BOX) === Math.floor(c / BOX) && Math.floor(b / BOX) === Math.floor(d / BOX);
}

function blankGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
}

function labelView(view) {
  return {
    play: "Play",
    daily: "Daily",
    learn: "Learn",
    leaderboard: "Leaderboard",
    profile: "Profile",
    pro: "Pro",
  }[view];
}

function formatTime(total) {
  const minutes = Math.floor(total / 60).toString().padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatSet(set) {
  return set.size ? [...set].sort().join(", ") : "nothing yet";
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  clearTimeout(toastId);
  toast.textContent = message;
  toast.classList.remove("hidden");
  toastId = setTimeout(() => toast.classList.add("hidden"), 3000);
}

function shuffle(items, rng) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function hashString(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function rng() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
