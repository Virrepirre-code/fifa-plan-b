/* ---------- Plan B FIFA Cup ----------
 * Vanilla JS app. State i localStorage.
 * Author: Plan B-andan.
 */

const STORAGE_KEY = 'planb-fifa-cup-v1';

const PLAN_B_NAMES = [
  'BIM Bröllop', 'VDC Vikings', 'Ritningarna 11', 'Sista Tidplanen FC',
  'Bygglovsbeviljat United', 'Stomljuden', 'ÄTA-tornadon', 'Klarrapport Rovers',
  'Mängdförteckning AB', 'Tekniska Beskrivningar', 'Avvikelse FC', 'Slack-tiden',
  'Egenkontrollen', 'Schaktbotten Dynamo', 'Toleransklass C', 'KMA-Galaxen',
  'Snabbtittarna', 'Excel-Elit', 'Förbesiktningarna', 'Garantitiden'
];
const PLAN_B_EMOJIS = ['⚽','🏗️','📐','📏','🔨','🛠️','🦺','🥅','🎯','🏆','🚧','📊','📋','💼','🤖','🧱'];

// Försenade / roliga toast-meddelanden
const HUMOR_TOASTS = [
  '💾 Sparat. Som en sen ÄTA.',
  '✅ Resultatet är inrapporterat. Klarrapport på gång.',
  '🏗️ Bygglov beviljat för matchen.',
  '📋 Det här går till protokollet.',
  '⚠️ Egenkontrollen godkänd.',
  '🎯 Mål registrerat i BIM-modellen.',
];

// ---------- State ----------
const defaultState = {
  settings: {
    name: 'Plan B FIFA Cup',
    groupMode: 'count',  // 'count' | 'size'
    groupCount: 2,
    groupSize: 4,
    matchLength: 6,
    advanceCount: 2,
  },
  players: [],       // { id, name, team, emoji }
  groups: [],        // { id: 'A', playerIds: [] }
  matches: [],       // { id, stage, groupId, round, p1, p2, s1, s2, played, bracketSlot }
  knockoutGenerated: false,
};

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    const merged = { ...structuredClone(defaultState), ...parsed };
    merged.settings = { ...defaultState.settings, ...(parsed.settings || {}) };
    return merged;
  } catch (e) {
    console.error('Kunde inte läsa state:', e);
    return structuredClone(defaultState);
  }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (window.PlanBSync && window.PlanBSync.push) {
    window.PlanBSync.push(state);
  }
}

// ---------- Utils ----------
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const uid = () => Math.random().toString(36).slice(2, 10);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2400);
}

function getPlayer(id) {
  return state.players.find(p => p.id === id);
}

// ---------- Tabs ----------
function initTabs() {
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      $$('.tab').forEach(t => t.classList.toggle('active', t === tab));
      $$('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === target));
      // Re-render visning vid tab-byte (för uppdaterad data)
      renderAll();
    });
  });
  // "data-go" länkar (snabbnav)
  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-go]');
    if (trigger) {
      const target = trigger.dataset.go;
      const tab = $(`.tab[data-tab="${target}"]`);
      if (tab) tab.click();
    }
  });
}

// ---------- Players ----------
function initPlayers() {
  $('#addPlayerForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#playerName').value.trim();
    const team = $('#playerTeam').value.trim();
    const emoji = $('#playerEmoji').value.trim() || '⚽';
    if (!name) return;
    state.players.push({ id: uid(), name, team, emoji });
    saveState();
    $('#playerName').value = '';
    $('#playerTeam').value = '';
    $('#playerEmoji').value = '⚽';
    renderAll();
    toast(`✅ ${name} är inhyrd!`);
  });

  $('[data-quick-name]').addEventListener('click', () => {
    const usedNames = new Set(state.players.map(p => p.name));
    const candidates = PLAN_B_NAMES.filter(n => !usedNames.has(n));
    if (candidates.length === 0) {
      toast('🎲 Alla skojnamn är slut. Hitta på själv.');
      return;
    }
    $('#playerName').value = candidates[Math.floor(Math.random()*candidates.length)];
    $('#playerEmoji').value = PLAN_B_EMOJIS[Math.floor(Math.random()*PLAN_B_EMOJIS.length)];
    $('#playerName').focus();
  });

  const onGroupSizeChange = e => {
    let val = parseInt(e.target.value);
    if (Number.isNaN(val)) val = 4;
    val = Math.max(2, Math.min(12, val));
    state.settings.groupSize = val;
    saveState();
    updateGenerateInfo();
  };
  $('#groupSize').addEventListener('change', e => {
    onGroupSizeChange(e);
    e.target.value = state.settings.groupSize;
  });
  $('#groupSize').addEventListener('input', onGroupSizeChange);

  const onGroupCountChange = e => {
    let val = parseInt(e.target.value);
    if (Number.isNaN(val)) val = 2;
    val = Math.max(1, Math.min(16, val));
    state.settings.groupCount = val;
    saveState();
    updateGenerateInfo();
  };
  $('#groupCount').addEventListener('change', e => {
    onGroupCountChange(e);
    e.target.value = state.settings.groupCount;
  });
  $('#groupCount').addEventListener('input', onGroupCountChange);

  $$('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      state.settings.groupMode = mode;
      saveState();
      syncGroupModeUI();
      updateGenerateInfo();
    });
  });
  $('#matchLength').addEventListener('change', e => {
    state.settings.matchLength = parseInt(e.target.value) || 6;
    saveState();
    $('#rule-length').textContent = state.settings.matchLength;
  });
  $('#advanceCount').addEventListener('change', e => {
    state.settings.advanceCount = parseInt(e.target.value);
    saveState();
  });

  $('#generateGroupsBtn').addEventListener('click', generateGroupsAndSchedule);
  $('#clearGroupsBtn').addEventListener('click', () => {
    if (state.groups.length === 0 && state.matches.length === 0) return;
    if (!confirm('Säker? Detta raderar alla grupper, matcher och resultat (spelarna är kvar).')) return;
    state.groups = [];
    state.matches = [];
    state.knockoutGenerated = false;
    saveState();
    renderAll();
    toast('🗑️ Allt rivet. Tabula rasa.');
  });
}

function renderPlayers() {
  const list = $('#playersList');
  $('#playerCount').textContent = `${state.players.length} spelare`;

  if (state.players.length === 0) {
    list.innerHTML = `<div class="empty">Ingen är inplanerad än. Som en bygglovsansökan i juli.</div>`;
    return;
  }

  list.innerHTML = state.players.map(p => `
    <div class="player-card" data-player-id="${p.id}" title="Klicka för att redigera">
      <div class="player-emoji">${escapeHtml(p.emoji)}</div>
      <div class="player-body">
        <div class="player-name">${escapeHtml(p.name)}</div>
        <div class="player-team">${escapeHtml(p.team) || 'Inget favoritlag valt'}</div>
        ${p.motto ? `<div class="player-motto">${escapeHtml(p.motto)}</div>` : ''}
      </div>
    </div>
  `).join('');

  $$('.player-card').forEach(card => {
    card.addEventListener('click', () => openPlayerModal(card.dataset.playerId));
  });

  // Sync inputs
  $('#groupSize').value = state.settings.groupSize;
  $('#groupCount').value = state.settings.groupCount;
  $('#matchLength').value = state.settings.matchLength;
  $('#advanceCount').value = state.settings.advanceCount;
  syncGroupModeUI();
  updateGenerateInfo();
}

function computeGroupSplit(n) {
  if (n < 2) return { numGroups: 0, sizes: [] };
  let numGroups;
  if (state.settings.groupMode === 'count') {
    numGroups = Math.max(1, Math.min(n, state.settings.groupCount));
  } else {
    numGroups = Math.max(1, Math.round(n / state.settings.groupSize));
  }
  const base = Math.floor(n / numGroups);
  const extra = n % numGroups;
  const sizes = Array.from({length: numGroups}, (_, i) => base + (i < extra ? 1 : 0));
  return { numGroups, sizes };
}

function syncGroupModeUI() {
  const mode = state.settings.groupMode || 'count';
  $$('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  $$('[data-mode-field]').forEach(el => {
    el.hidden = el.dataset.modeField !== mode;
  });
}

function updateGenerateInfo() {
  const info = $('#generateInfo');
  const n = state.players.length;
  if (n < 2) {
    info.textContent = `Du behöver minst 2 spelare för att köra en turnering. (Just nu: ${n})`;
    return;
  }
  const { numGroups, sizes } = computeGroupSplit(n);
  const minSize = Math.min(...sizes);
  const maxSize = Math.max(...sizes);
  const sizeText = minSize === maxSize ? `${minSize}` : `${minSize}–${maxSize}`;
  let txt = `${n} spelare → ${numGroups} grupp${numGroups === 1 ? '' : 'er'} med ${sizeText} spelare`;
  if (minSize === maxSize) {
    txt += '. Perfekt fördelning. 🎯';
  } else {
    txt += ` (storlek: ${sizes.join(' + ')}).`;
  }
  info.textContent = txt;
}

// ---------- Group + schedule generation ----------
function generateGroupsAndSchedule() {
  const n = state.players.length;
  if (n < 2) {
    toast(`Behöver minst 2 spelare. Just nu: ${n}.`);
    return;
  }
  if (state.matches.some(m => m.played) && !confirm('Du har redan spelade matcher. Vill du verkligen slumpa om allt och nollställa resultaten?')) {
    return;
  }

  const shuffled = shuffle(state.players);
  const { numGroups } = computeGroupSplit(n);
  const groups = [];
  for (let i = 0; i < numGroups; i++) {
    groups.push({ id: String.fromCharCode(65 + i), playerIds: [] });
  }
  // Distribute snake-style for fair-ish groups
  shuffled.forEach((p, idx) => {
    const g = idx % numGroups;
    groups[g].playerIds.push(p.id);
  });

  state.groups = groups;
  state.matches = [];
  state.knockoutGenerated = false;

  // Generate round-robin matches per group
  groups.forEach(group => {
    const matches = roundRobinSchedule(group.playerIds);
    matches.forEach(({ round, p1, p2 }) => {
      state.matches.push({
        id: uid(),
        stage: 'group',
        groupId: group.id,
        round,
        p1, p2,
        s1: null, s2: null,
        played: false,
      });
    });
  });

  saveState();
  renderAll();
  toast(`🎲 ${groups.length} grupper genererade · ${state.matches.length} matcher i tidplanen.`);
  // Navigera till grupper
  $('.tab[data-tab="grupper"]').click();
}

/**
 * Round-robin schedule via circle method.
 * Returnerar [{ round, p1, p2 }, ...] ordnade per round.
 */
function roundRobinSchedule(playerIds) {
  const ids = [...playerIds];
  const hasBye = ids.length % 2 !== 0;
  if (hasBye) ids.push(null); // bye marker
  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;

  const matches = [];
  const arr = [...ids];

  for (let r = 1; r <= rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== null && b !== null) {
        matches.push({ round: r, p1: a, p2: b });
      }
    }
    // Rotate (keep first fixed)
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop());
    arr.splice(0, arr.length, fixed, ...rest);
  }
  return matches;
}

// ---------- Standings ----------
function calcStandings(groupId) {
  const group = state.groups.find(g => g.id === groupId);
  if (!group) return [];

  const stats = {};
  group.playerIds.forEach(pid => {
    stats[pid] = { id: pid, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  });

  state.matches
    .filter(m => m.stage === 'group' && m.groupId === groupId && m.played)
    .forEach(m => {
      const a = stats[m.p1], b = stats[m.p2];
      if (!a || !b) return;
      a.played++; b.played++;
      a.gf += m.s1; a.ga += m.s2;
      b.gf += m.s2; b.ga += m.s1;
      if (m.s1 > m.s2) { a.w++; b.l++; a.pts += 3; }
      else if (m.s1 < m.s2) { b.w++; a.l++; b.pts += 3; }
      else { a.d++; b.d++; a.pts += 1; b.pts += 1; }
    });

  const rows = Object.values(stats).map(s => ({
    ...s,
    gd: s.gf - s.ga,
  }));

  rows.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    // Head-to-head
    const h2h = state.matches.find(m =>
      m.played && m.stage === 'group' &&
      ((m.p1 === a.id && m.p2 === b.id) || (m.p1 === b.id && m.p2 === a.id))
    );
    if (h2h) {
      if (h2h.p1 === a.id) {
        if (h2h.s1 !== h2h.s2) return h2h.s2 - h2h.s1;
      } else {
        if (h2h.s1 !== h2h.s2) return h2h.s1 - h2h.s2;
      }
    }
    return 0;
  });

  return rows;
}

function renderGroups() {
  const container = $('#groupsContainer');
  if (state.groups.length === 0) {
    container.innerHTML = `
      <div class="card empty-card">
        <h3>Inga grupper inplanerade än.</h3>
        <p class="muted">Lägg till spelare och tryck på "Slumpa grupper" under <strong>Spelare</strong>-fliken.</p>
        <button class="btn btn-primary" data-go="spelare">Till spelarfliken</button>
      </div>`;
    return;
  }

  container.innerHTML = `<div class="groups-grid">` + state.groups.map(group => {
    const rows = calcStandings(group.id);
    const adv = state.settings.advanceCount;
    return `
      <div class="group-card">
        <div class="group-header">
          <span>Plan ${group.id}</span>
          <span class="group-sub">topp ${adv} går vidare</span>
        </div>
        <div class="standings-wrap">
          <table class="standings-table">
            <thead>
              <tr>
                <th style="text-align:left">Spelare</th>
                <th title="Spelade">S</th>
                <th title="Vinster">V</th>
                <th title="Oavgjorda">O</th>
                <th title="Förluster">F</th>
                <th title="Gjorda mål">GM</th>
                <th title="Insläppta mål">IM</th>
                <th title="Målskillnad">MS</th>
                <th title="Poäng">P</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((r, idx) => {
                const p = getPlayer(r.id);
                const cls = idx < adv ? 'qualify' : '';
                return `
                  <tr class="${cls}">
                    <td class="player-cell" title="${escapeHtml(p?.name || '?')}">${escapeHtml(p?.emoji || '')} ${escapeHtml(p?.name || '?')}</td>
                    <td>${r.played}</td>
                    <td>${r.w}</td>
                    <td>${r.d}</td>
                    <td>${r.l}</td>
                    <td>${r.gf}</td>
                    <td>${r.ga}</td>
                    <td>${r.gd > 0 ? '+' : ''}${r.gd}</td>
                    <td class="pts">${r.pts}</td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }).join('') + `</div>`;
}

// ---------- Schedule ----------
let scheduleFilter = 'all';
function initSchedule() {
  $$('.schema-filters .chip-toggle').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('.schema-filters .chip-toggle').forEach(c => c.classList.toggle('active', c === chip));
      scheduleFilter = chip.dataset.filter;
      renderSchedule();
    });
  });
}

function renderSchedule() {
  const container = $('#scheduleContainer');
  if (state.matches.length === 0) {
    container.innerHTML = `
      <div class="card empty-card">
        <h3>Inga matcher i schemat.</h3>
        <p class="muted">Generera grupper först så fyller vi tidplanen.</p>
      </div>`;
    return;
  }

  let matches = [...state.matches];
  if (scheduleFilter === 'upcoming') matches = matches.filter(m => !m.played);
  else if (scheduleFilter === 'played') matches = matches.filter(m => m.played);

  if (matches.length === 0) {
    container.innerHTML = `<div class="card empty-card"><h3>Inga matcher i filtret.</h3></div>`;
    return;
  }

  // Group matches: group stage by round, then knockout stages separately
  const groupMatchesByRound = {};
  const knockoutByStage = {};
  matches.forEach(m => {
    if (m.stage === 'group') {
      const key = `Omgång ${m.round}`;
      (groupMatchesByRound[key] ||= []).push(m);
    } else {
      const labels = { quarter: 'Kvartsfinal', semi: 'Semifinal', final: 'Final', third: 'Bronsmatch' };
      const key = labels[m.stage] || m.stage;
      (knockoutByStage[key] ||= []).push(m);
    }
  });

  const blocks = [];
  Object.entries(groupMatchesByRound).forEach(([title, ms]) => {
    blocks.push(renderRoundBlock(`📅 ${title}`, ms));
  });
  ['Kvartsfinal', 'Semifinal', 'Bronsmatch', 'Final'].forEach(stage => {
    if (knockoutByStage[stage]) {
      blocks.push(renderRoundBlock(`🏆 ${stage}`, knockoutByStage[stage]));
    }
  });

  container.innerHTML = blocks.join('');
  attachMatchClicks(container);
}

function renderRoundBlock(title, matches) {
  return `
    <div class="round-block">
      <h3 class="round-title">${title}</h3>
      <div class="matches-list">
        ${matches.map(renderMatchRow).join('')}
      </div>
    </div>`;
}

function renderMatchRow(m) {
  const p1 = getPlayer(m.p1);
  const p2 = getPlayer(m.p2);
  const played = m.played;
  const tag = m.stage === 'group' ? `Plan ${m.groupId}` : ({quarter:'Kvart',semi:'Semi',final:'Final',third:'Brons'}[m.stage] || m.stage);

  let p1Win = false, p2Win = false;
  if (played) {
    if (m.s1 > m.s2) p1Win = true;
    else if (m.s2 > m.s1) p2Win = true;
  }

  const p1Name = p1 ? `${escapeHtml(p1.emoji)} ${escapeHtml(p1.name)}` : '<span class="muted">TBD</span>';
  const p2Name = p2 ? `${escapeHtml(p2.name)} ${escapeHtml(p2.emoji)}` : '<span class="muted">TBD</span>';

  return `
    <div class="match-row ${played ? 'played' : 'upcoming'}" data-match-id="${m.id}">
      <span class="match-tag">${escapeHtml(tag)}</span>
      <div class="match-side-label">
        ${p1Win ? '<span class="match-winner-arrow">▶</span>' : ''}
        <span class="pname">${p1Name}</span>
      </div>
      <div class="match-score ${played ? '' : 'unplayed'}">
        ${played ? `${m.s1} – ${m.s2}` : 'Spela'}
      </div>
      <div class="match-side-label right">
        <span class="pname">${p2Name}</span>
        ${p2Win ? '<span class="match-winner-arrow">◀</span>' : ''}
      </div>
    </div>`;
}

function attachMatchClicks(scope = document) {
  $$('.match-row', scope).forEach(row => {
    row.addEventListener('click', () => openMatchModal(row.dataset.matchId));
  });
}

// ---------- Player edit modal ----------
const EMOJI_OPTIONS = [
  '⚽','🦊','🚀','🐻','🦄','🦅','🎩','🎯','🔥','💀','👑','🐉',
  '🦁','🐅','🐺','🐢','🦏','🐙','🦈','🤖','👽','🥷','🧙','🧛',
  '🦸','🧟','🍕','🍻','🌮','🦖','⚡','💣','🧨','🚨','💎','🌶️',
];
let currentPlayerId = null;

function initPlayerModal() {
  $('#playerModalCloseBtn').addEventListener('click', closePlayerModal);
  $('#playerModal').addEventListener('click', e => {
    if (e.target === $('#playerModal')) closePlayerModal();
  });
  $('#playerEditSaveBtn').addEventListener('click', savePlayerEdit);
  $('#playerEditRemoveBtn').addEventListener('click', removePlayerFromModal);

  // Live-preview av emoji-input
  $('#playerEditEmoji').addEventListener('input', e => {
    const val = e.target.value.trim() || '⚽';
    $('#playerModalEmoji').textContent = val;
    refreshEmojiPickerSelection();
  });

  // Bygg emoji-pickern en gång
  const picker = $('#emojiPicker');
  picker.innerHTML = EMOJI_OPTIONS.map(e => `<button type="button" class="emoji-btn" data-emoji="${e}">${e}</button>`).join('');
  picker.addEventListener('click', e => {
    const btn = e.target.closest('.emoji-btn');
    if (!btn) return;
    $('#playerEditEmoji').value = btn.dataset.emoji;
    $('#playerEditEmoji').dispatchEvent(new Event('input'));
  });
}

function refreshEmojiPickerSelection() {
  const current = $('#playerEditEmoji').value.trim();
  $$('#emojiPicker .emoji-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.emoji === current);
  });
}

function openPlayerModal(playerId) {
  const p = getPlayer(playerId);
  if (!p) return;
  currentPlayerId = playerId;

  // Räkna ut record
  const playedMatches = state.matches.filter(m => m.played && (m.p1 === playerId || m.p2 === playerId));
  let w = 0, l = 0, d = 0, gf = 0, ga = 0;
  playedMatches.forEach(m => {
    const isP1 = m.p1 === playerId;
    const my = isP1 ? m.s1 : m.s2;
    const opp = isP1 ? m.s2 : m.s1;
    gf += my; ga += opp;
    if (my > opp) w++;
    else if (my < opp) l++;
    else d++;
  });
  const recordText = playedMatches.length > 0
    ? `${playedMatches.length} matcher · ${w}V ${d}O ${l}F · ${gf}–${ga} mål`
    : 'Inga matcher spelade än. Profilbestämmer.';

  $('#playerModalTitle').textContent = p.name;
  $('#playerModalEmoji').textContent = p.emoji || '⚽';
  $('#playerModalRecord').textContent = recordText;
  $('#playerEditName').value = p.name;
  $('#playerEditEmoji').value = p.emoji || '⚽';
  $('#playerEditTeam').value = p.team || '';
  $('#playerEditMotto').value = p.motto || '';
  refreshEmojiPickerSelection();

  $('#playerModal').hidden = false;
  setTimeout(() => $('#playerEditName').focus(), 50);
}

function closePlayerModal() {
  $('#playerModal').hidden = true;
  currentPlayerId = null;
}

function savePlayerEdit() {
  if (!currentPlayerId) return;
  const p = getPlayer(currentPlayerId);
  if (!p) return;
  const name = $('#playerEditName').value.trim();
  if (!name) {
    toast('⚠️ Namn får inte vara tomt.');
    return;
  }
  p.name = name;
  p.emoji = $('#playerEditEmoji').value.trim() || '⚽';
  p.team = $('#playerEditTeam').value.trim();
  p.motto = $('#playerEditMotto').value.trim();
  saveState();
  closePlayerModal();
  renderAll();
  toast(`✅ ${p.name}s profil uppdaterad.`);
}

function removePlayerFromModal() {
  if (!currentPlayerId) return;
  const p = getPlayer(currentPlayerId);
  if (!p) return;
  const inUse = state.groups.length > 0 || state.matches.length > 0;
  const msg = inUse
    ? `Sparka ${p.name}? Detta rensar alla grupper och matcher (resultat förloras).`
    : `Sparka ${p.name}?`;
  if (!confirm(msg)) return;
  state.players = state.players.filter(x => x.id !== currentPlayerId);
  if (inUse) {
    state.groups = [];
    state.matches = [];
    state.knockoutGenerated = false;
  }
  saveState();
  closePlayerModal();
  renderAll();
  toast(`👋 ${p.name} är ute.`);
}

// ---------- Match modal ----------
let currentMatchId = null;
function initModal() {
  $('#modalCloseBtn').addEventListener('click', closeModal);
  $('#matchModal').addEventListener('click', e => {
    if (e.target === $('#matchModal')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
  $('#modalSaveBtn').addEventListener('click', saveMatchResult);
  $('#modalClearBtn').addEventListener('click', clearMatchResult);
}

function openMatchModal(matchId) {
  const m = state.matches.find(x => x.id === matchId);
  if (!m) return;
  const p1 = getPlayer(m.p1);
  const p2 = getPlayer(m.p2);
  if (!p1 || !p2) {
    toast('⚠️ TBD — slutspelet är inte ihopkopplat än.');
    return;
  }
  currentMatchId = matchId;
  const stageLabel = m.stage === 'group'
    ? `Plan ${m.groupId} · Omgång ${m.round}`
    : ({quarter:'Kvartsfinal', semi:'Semifinal', final:'Final', third:'Bronsmatch'}[m.stage] || m.stage);

  $('#modalTitle').textContent = stageLabel;
  $('#modalSub').textContent = 'Lägg in resultatet. Inga sena ändringar utan ÄTA.';
  $('#modalP1Name').innerHTML = `${escapeHtml(p1.emoji)} ${escapeHtml(p1.name)}`;
  $('#modalP2Name').innerHTML = `${escapeHtml(p2.emoji)} ${escapeHtml(p2.name)}`;
  $('#modalScore1').value = m.played ? m.s1 : '';
  $('#modalScore2').value = m.played ? m.s2 : '';
  $('#matchModal').hidden = false;
  setTimeout(() => $('#modalScore1').focus(), 50);
}

function closeModal() {
  $('#matchModal').hidden = true;
  currentMatchId = null;
}

function saveMatchResult() {
  if (!currentMatchId) return;
  const m = state.matches.find(x => x.id === currentMatchId);
  if (!m) return;
  const s1 = parseInt($('#modalScore1').value);
  const s2 = parseInt($('#modalScore2').value);
  if (Number.isNaN(s1) || Number.isNaN(s2) || s1 < 0 || s2 < 0) {
    toast('⚠️ Fyll i båda resultaten med positiva siffror.');
    return;
  }
  // Knockout draws inte tillåtna
  if (m.stage !== 'group' && s1 === s2) {
    if (!confirm('Oavgjort i slutspel? Då måste vi avgöra på straffar — välj en vinnare och addera 1 till deras score.')) return;
  }

  m.s1 = s1; m.s2 = s2; m.played = true;
  saveState();
  closeModal();
  renderAll();
  propagateKnockoutWinner(m);
  saveState();
  renderAll();
  toast(HUMOR_TOASTS[Math.floor(Math.random() * HUMOR_TOASTS.length)]);
}

function clearMatchResult() {
  if (!currentMatchId) return;
  const m = state.matches.find(x => x.id === currentMatchId);
  if (!m) return;
  m.s1 = null; m.s2 = null; m.played = false;
  saveState();
  closeModal();
  renderAll();
  toast('🔄 Match nollställd.');
}

// ---------- Knockout / Bracket ----------
function initKnockout() {
  $('#generateKnockoutBtn').addEventListener('click', generateKnockout);
}

function generateKnockout() {
  if (state.groups.length === 0) {
    toast('Generera grupper först!');
    return;
  }
  const groupMatches = state.matches.filter(m => m.stage === 'group');
  const unplayed = groupMatches.filter(m => !m.played);
  if (unplayed.length > 0) {
    if (!confirm(`${unplayed.length} gruppmatcher är inte spelade än. Generera slutspelet ändå? (Tabellen avgör seedingen.)`)) {
      return;
    }
  }
  if (state.knockoutGenerated) {
    if (!confirm('Slutspelet finns redan. Generera om? Befintliga slutspelsmatcher rensas.')) return;
    state.matches = state.matches.filter(m => m.stage === 'group');
  }

  const adv = state.settings.advanceCount;
  const qualifiers = [];
  state.groups.forEach(group => {
    const standings = calcStandings(group.id);
    standings.slice(0, adv).forEach((s, pos) => {
      qualifiers.push({ playerId: s.id, group: group.id, pos: pos + 1 });
    });
  });

  // Skapa parningar enligt klassiskt schema (1A vs 2B, 1B vs 2A...)
  const pairs = buildBracketPairs(qualifiers);
  const totalSlots = pairs.length * 2;
  let stage;
  if (totalSlots >= 8) stage = 'quarter';
  else if (totalSlots >= 4) stage = 'semi';
  else stage = 'final';

  // Lägg in matcher som kedjas via bracketSlot
  // bracketSlot konvention: stage + index så att vinnare från slot 0+1 går till nästa stage slot 0
  const generated = [];
  pairs.forEach((pair, idx) => {
    generated.push({
      id: uid(),
      stage,
      groupId: null,
      round: 1,
      p1: pair[0]?.playerId || null,
      p2: pair[1]?.playerId || null,
      s1: null, s2: null,
      played: false,
      bracketSlot: idx,
    });
  });

  // Generera resten av bracketen (semi, final, brons) som tomma
  const stagesOrder = ['quarter', 'semi', 'final'];
  const startIdx = stagesOrder.indexOf(stage);
  let prevCount = pairs.length;
  for (let si = startIdx + 1; si < stagesOrder.length; si++) {
    const nextCount = Math.floor(prevCount / 2);
    if (nextCount === 0) break;
    for (let i = 0; i < nextCount; i++) {
      generated.push({
        id: uid(),
        stage: stagesOrder[si],
        groupId: null,
        round: 1,
        p1: null, p2: null,
        s1: null, s2: null,
        played: false,
        bracketSlot: i,
      });
    }
    prevCount = nextCount;
  }
  // Bronsmatch om vi har en semi-final
  if (generated.some(m => m.stage === 'semi')) {
    generated.push({
      id: uid(),
      stage: 'third',
      groupId: null,
      round: 1,
      p1: null, p2: null,
      s1: null, s2: null,
      played: false,
      bracketSlot: 0,
    });
  }

  state.matches.push(...generated);
  state.knockoutGenerated = true;

  // Om gruppspelet redan är klart, propagera vinnare in i nästa runda direkt (om någon redan har spelat sin match)
  state.matches.filter(m => m.played && m.stage !== 'group').forEach(propagateKnockoutWinner);

  saveState();
  renderAll();
  $('.tab[data-tab="slutspel"]').click();
  toast('🏆 Slutspelet är ritat! Lycka till.');
}

function buildBracketPairs(qualifiers) {
  // qualifiers: [{playerId, group, pos}]
  // Standardseeding: 1A vs 2B, 1B vs 2A, 1C vs 2D, 1D vs 2C ... osv.
  // Om bara en går vidare per grupp: matcha grupper i ordning A vs B, C vs D
  const adv = state.settings.advanceCount;
  const groups = state.groups.map(g => g.id);
  const pairs = [];

  if (adv === 1) {
    for (let i = 0; i < groups.length; i += 2) {
      const a = qualifiers.find(q => q.group === groups[i] && q.pos === 1);
      const b = qualifiers.find(q => q.group === groups[i+1] && q.pos === 1);
      if (a || b) pairs.push([a, b].filter(Boolean));
    }
  } else {
    // adv === 2 (eller mer, behandla som 2)
    for (let i = 0; i < groups.length; i += 2) {
      const g1 = groups[i];
      const g2 = groups[i+1];
      if (!g2) {
        // Udda antal grupper: para inom samma grupp 1v2
        const a = qualifiers.find(q => q.group === g1 && q.pos === 1);
        const b = qualifiers.find(q => q.group === g1 && q.pos === 2);
        if (a && b) pairs.push([a, b]);
        continue;
      }
      const a1 = qualifiers.find(q => q.group === g1 && q.pos === 1);
      const b2 = qualifiers.find(q => q.group === g2 && q.pos === 2);
      const b1 = qualifiers.find(q => q.group === g2 && q.pos === 1);
      const a2 = qualifiers.find(q => q.group === g1 && q.pos === 2);
      if (a1 || b2) pairs.push([a1, b2]);
      if (b1 || a2) pairs.push([b1, a2]);
    }
  }
  return pairs;
}

function propagateKnockoutWinner(match) {
  if (match.stage === 'group') return;
  if (!match.played) return;
  if (match.s1 === match.s2) return; // sätter vi inte vidare

  const winnerId = match.s1 > match.s2 ? match.p1 : match.p2;
  const loserId = match.s1 > match.s2 ? match.p2 : match.p1;

  const order = ['quarter', 'semi', 'final'];
  const stageIdx = order.indexOf(match.stage);
  if (stageIdx === -1) return;

  // Om vi spelade en semifinal: förloraren går till tredjepris-match (third)
  if (match.stage === 'semi') {
    const thirdMatch = state.matches.find(m => m.stage === 'third');
    if (thirdMatch) {
      if (match.bracketSlot === 0) thirdMatch.p1 = loserId;
      else thirdMatch.p2 = loserId;
    }
  }

  // Skicka vinnaren till nästa stage
  const nextStage = order[stageIdx + 1];
  if (!nextStage) return;
  const nextSlot = Math.floor(match.bracketSlot / 2);
  const nextMatch = state.matches.find(m => m.stage === nextStage && m.bracketSlot === nextSlot);
  if (!nextMatch) return;
  if (match.bracketSlot % 2 === 0) nextMatch.p1 = winnerId;
  else nextMatch.p2 = winnerId;
}

function renderKnockout() {
  const container = $('#knockoutContainer');
  if (!state.knockoutGenerated || !state.matches.some(m => m.stage !== 'group')) {
    container.innerHTML = `
      <div class="card empty-card">
        <h3>Slutspelet är inte byggt än.</h3>
        <p class="muted">Spela klart gruppspelet, sen trycker du på "Generera slutspel".</p>
      </div>`;
    return;
  }

  const stageLabels = { quarter: 'Kvartsfinal', semi: 'Semifinal', final: 'Final', third: 'Bronsmatch' };
  const order = ['quarter', 'semi', 'third', 'final'];

  const stages = order
    .map(stage => ({
      stage,
      label: stageLabels[stage],
      matches: state.matches.filter(m => m.stage === stage).sort((a,b) => a.bracketSlot - b.bracketSlot)
    }))
    .filter(s => s.matches.length > 0);

  const finalMatch = state.matches.find(m => m.stage === 'final');
  let championBanner = '';
  if (finalMatch && finalMatch.played && finalMatch.s1 !== finalMatch.s2) {
    const champ = getPlayer(finalMatch.s1 > finalMatch.s2 ? finalMatch.p1 : finalMatch.p2);
    if (champ) {
      championBanner = `
        <div class="card" style="text-align:center; background: linear-gradient(135deg, var(--primary), var(--accent)); color: var(--primary-ink); border: none;">
          <div style="font-size:54px;">🏆</div>
          <h2 style="font-family:'Anton'; font-size:42px; margin:0;">MÄSTARE!</h2>
          <p style="font-size:28px; font-weight:800; margin:8px 0 0;">${escapeHtml(champ.emoji)} ${escapeHtml(champ.name)}</p>
          <p style="margin:8px 0 0; opacity:0.7; font-weight:600;">— ny innehavare av Plan B FIFA-pokalen. Drinkar betalas av förlorarna.</p>
        </div>`;
    }
  }

  container.innerHTML = championBanner + `
    <div class="bracket">
      ${stages.map(s => `
        <div class="bracket-round">
          <div class="bracket-round-title">${s.label}</div>
          ${s.matches.map(m => renderBracketMatch(m)).join('')}
        </div>
      `).join('')}
    </div>`;

  $$('.bracket-match', container).forEach(el => {
    el.addEventListener('click', () => openMatchModal(el.dataset.matchId));
  });
}

function renderBracketMatch(m) {
  const p1 = getPlayer(m.p1);
  const p2 = getPlayer(m.p2);
  const played = m.played;
  const p1Won = played && m.s1 > m.s2;
  const p2Won = played && m.s2 > m.s1;
  return `
    <div class="bracket-match" data-match-id="${m.id}">
      <div class="bracket-side ${p1Won ? 'winner' : ''} ${!p1 ? 'tbd' : ''}">
        <span>${p1 ? `${escapeHtml(p1.emoji)} ${escapeHtml(p1.name)}` : 'TBD'}</span>
        <span class="bscore">${played ? m.s1 : ''}</span>
      </div>
      <div class="bracket-side ${p2Won ? 'winner' : ''} ${!p2 ? 'tbd' : ''}">
        <span>${p2 ? `${escapeHtml(p2.emoji)} ${escapeHtml(p2.name)}` : 'TBD'}</span>
        <span class="bscore">${played ? m.s2 : ''}</span>
      </div>
    </div>`;
}

// ---------- Hem / Dashboard ----------
function renderDashboard() {
  $('#stat-players').textContent = state.players.length;
  $('#stat-matches').textContent = state.matches.length;
  $('#stat-played').textContent = state.matches.filter(m => m.played).length;
  $('#stat-goals').textContent = state.matches
    .filter(m => m.played)
    .reduce((acc, m) => acc + m.s1 + m.s2, 0);

  $('#rule-length').textContent = state.settings.matchLength;

  // Senaste resultaten (max 5)
  const recent = state.matches.filter(m => m.played).slice(-5).reverse();
  const recentEl = $('#recentResults');
  if (recent.length === 0) {
    recentEl.innerHTML = `<div class="empty">Inga matcher spelade än. Som ett bygge utan tidplan.</div>`;
  } else {
    recentEl.innerHTML = recent.map(m => {
      const p1 = getPlayer(m.p1), p2 = getPlayer(m.p2);
      if (!p1 || !p2) return '';
      return `<div class="recent-row">
        <div class="name">${escapeHtml(p1.emoji)} ${escapeHtml(p1.name)}</div>
        <div class="score-mini">${m.s1} – ${m.s2}</div>
        <div class="name right">${escapeHtml(p2.name)} ${escapeHtml(p2.emoji)}</div>
      </div>`;
    }).join('');
  }

  // Nästa matcher — sortera så att omgång 1 från alla grupper kommer före omgång 2 osv.
  const STAGE_ORDER = { group: 0, quarter: 1, semi: 2, third: 3, final: 4 };
  const upcoming = state.matches
    .filter(m => !m.played && m.p1 && m.p2)
    .slice()
    .sort((a, b) => {
      const sa = STAGE_ORDER[a.stage] ?? 99;
      const sb = STAGE_ORDER[b.stage] ?? 99;
      if (sa !== sb) return sa - sb;
      if (a.stage === 'group' && b.stage === 'group') {
        if (a.round !== b.round) return a.round - b.round;
        return (a.groupId || '').localeCompare(b.groupId || '');
      }
      return (a.bracketSlot ?? 0) - (b.bracketSlot ?? 0);
    })
    .slice(0, 5);
  const upEl = $('#upcomingMatches');
  if (upcoming.length === 0) {
    upEl.innerHTML = `<div class="empty">Inga schemalagda matcher. Generera grupper för att börja.</div>`;
  } else {
    upEl.innerHTML = upcoming.map(m => {
      const p1 = getPlayer(m.p1), p2 = getPlayer(m.p2);
      if (!p1 || !p2) return '';
      const tag = m.stage === 'group' ? `Plan ${m.groupId} · O${m.round}` : ({quarter:'Kvart',semi:'Semi',final:'Final',third:'Brons'}[m.stage] || m.stage);
      return `<div class="recent-row" data-match-id="${m.id}" style="cursor:pointer">
        <div class="name">${escapeHtml(p1.emoji)} ${escapeHtml(p1.name)}</div>
        <div class="score-mini" style="font-family:'Inter'; font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:1px;">${tag}</div>
        <div class="name right">${escapeHtml(p2.name)} ${escapeHtml(p2.emoji)}</div>
      </div>`;
    }).join('');
    $$('#upcomingMatches .recent-row').forEach(row => {
      row.addEventListener('click', () => openMatchModal(row.dataset.matchId));
    });
  }

  // Status pill
  const pill = $('#tournamentStatus');
  const totalGroup = state.matches.filter(m => m.stage === 'group').length;
  const playedGroup = state.matches.filter(m => m.stage === 'group' && m.played).length;
  const finalMatch = state.matches.find(m => m.stage === 'final');

  if (state.players.length === 0) pill.textContent = '🟡 Ansökan inlämnad';
  else if (state.matches.length === 0) pill.textContent = '🟡 Bygglov pågår';
  else if (finalMatch && finalMatch.played) pill.textContent = '🏁 Slutbesiktning klar';
  else if (state.knockoutGenerated) pill.textContent = '🔥 Slutspel pågår';
  else if (playedGroup === totalGroup) pill.textContent = '✅ Gruppspel klart';
  else pill.textContent = `🟢 Bygglov beviljat (${playedGroup}/${totalGroup})`;
}

// ---------- Stats / Awards ----------
function computeAwards() {
  const playerStats = {};
  state.players.forEach(p => {
    playerStats[p.id] = {
      ...p,
      played: 0, wins: 0, losses: 0, draws: 0,
      goalsFor: 0, goalsAgainst: 0, biggestWin: 0, biggestLoss: 0,
      cleanSheets: 0, gotMauled: 0
    };
  });
  state.matches.filter(m => m.played).forEach(m => {
    const a = playerStats[m.p1], b = playerStats[m.p2];
    if (!a || !b) return;
    a.played++; b.played++;
    a.goalsFor += m.s1; a.goalsAgainst += m.s2;
    b.goalsFor += m.s2; b.goalsAgainst += m.s1;
    if (m.s2 === 0) a.cleanSheets++;
    if (m.s1 === 0) b.cleanSheets++;
    const diff = m.s1 - m.s2;
    if (diff > 0) {
      a.wins++; b.losses++;
      if (diff > a.biggestWin) a.biggestWin = diff;
      if (diff > b.gotMauled) b.gotMauled = diff;
    } else if (diff < 0) {
      b.wins++; a.losses++;
      const ad = -diff;
      if (ad > b.biggestWin) b.biggestWin = ad;
      if (ad > a.gotMauled) a.gotMauled = ad;
    } else {
      a.draws++; b.draws++;
    }
  });

  const arr = Object.values(playerStats).filter(p => p.played > 0);

  return {
    topScorer: arr.slice().sort((a, b) => b.goalsFor - a.goalsFor)[0],
    bestDefense: arr.slice().sort((a, b) => a.goalsAgainst/Math.max(a.played,1) - b.goalsAgainst/Math.max(b.played,1))[0],
    biggestWin: arr.slice().sort((a, b) => b.biggestWin - a.biggestWin)[0],
    mauled: arr.slice().sort((a, b) => b.gotMauled - a.gotMauled)[0],
    cleanSheets: arr.slice().sort((a, b) => b.cleanSheets - a.cleanSheets)[0],
    drawer: arr.slice().sort((a, b) => b.draws - a.draws)[0],
    list: arr,
  };
}

function renderStats() {
  const a = computeAwards();
  const grid = $('#awardsGrid');

  const awards = [
    { icon: '⚽', title: 'Skyttekungen', winner: a.topScorer, detail: w => `${w.goalsFor} mål på ${w.played} matcher` },
    { icon: '🧱', title: 'Murbruk-priset (bäst försvar)', winner: a.bestDefense, detail: w => `${(w.goalsAgainst/Math.max(w.played,1)).toFixed(2)} insläppta/match` },
    { icon: '💣', title: 'Stomljudspokalen (största seger)', winner: a.biggestWin, detail: w => w.biggestWin > 0 ? `+${w.biggestWin} mål i en match` : 'Inga vinster än' },
    { icon: '🩹', title: 'Konstruktionsfelet (största stryk)', winner: a.mauled, detail: w => w.gotMauled > 0 ? `–${w.gotMauled} mål i en match` : 'Helt skadefri' },
    { icon: '🧤', title: 'Hängmattan (clean sheets)', winner: a.cleanSheets, detail: w => `${w.cleanSheets} matcher utan baklängesmål` },
    { icon: '🤝', title: 'Diplomatpriset (flest oavgjorda)', winner: a.drawer, detail: w => `${w.draws} oavgjorda — alltid en kompromiss` },
  ];

  grid.innerHTML = awards.map(aw => `
    <div class="award-card">
      <div class="award-icon">${aw.icon}</div>
      <h3 class="award-title">${aw.title}</h3>
      ${aw.winner ? `
        <p class="award-winner">${escapeHtml(aw.winner.emoji)} ${escapeHtml(aw.winner.name)}</p>
        <p class="award-detail">${aw.detail(aw.winner)}</p>
      ` : `<p class="award-winner muted">— Inga matcher spelade än</p>`}
    </div>
  `).join('');

  // Top scorers
  const topEl = $('#topScorers');
  if (a.list.length === 0) {
    topEl.innerHTML = `<div class="empty">Spela några matcher så fyller vi den här.</div>`;
  } else {
    const sorted = a.list.slice().sort((x, y) => {
      if (y.goalsFor !== x.goalsFor) return y.goalsFor - x.goalsFor;
      return (y.wins - x.wins);
    });
    topEl.innerHTML = sorted.map((p, idx) => {
      const medal = ['🥇','🥈','🥉'][idx] || `<span style="display:inline-block;width:24px;text-align:center;color:var(--muted);font-weight:700">${idx+1}.</span>`;
      return `<div class="recent-row" style="grid-template-columns: 40px 1fr auto;">
        <span style="font-size:18px">${medal}</span>
        <span class="name">${escapeHtml(p.emoji)} ${escapeHtml(p.name)} <span class="muted small" style="font-weight:400">${p.wins}V ${p.draws}O ${p.losses}F</span></span>
        <span class="score-mini">${p.goalsFor} mål</span>
      </div>`;
    }).join('');
  }
}

// ---------- Audio: Plan B Kickoff anthem ----------
function initAudio() {
  const audio = $('#kickoffAudio');
  const player = $('#miniPlayer');
  const playBtn = $('#miniPlayBtn');
  const heroBtn = $('#heroKickoffBtn');
  const volume = $('#miniVolume');
  const closeBtn = $('#miniCloseBtn');
  const playIcon = playBtn.querySelector('.play-icon');
  const pauseIcon = playBtn.querySelector('.pause-icon');
  const timeEl = $('#miniTime');

  audio.volume = (parseInt(volume.value) || 70) / 100;

  const fmt = sec => {
    if (!isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const updatePlayState = () => {
    const playing = !audio.paused;
    playIcon.hidden = playing;
    pauseIcon.hidden = !playing;
    player.classList.toggle('playing', playing);
    if (heroBtn) {
      heroBtn.classList.toggle('playing', playing);
      heroBtn.textContent = playing ? '⏸ Pausa Plan B-låten' : '🎵 Sätt på Plan B-låten';
    }
  };

  const showPlayer = () => { player.hidden = false; };

  const togglePlay = async () => {
    showPlayer();
    if (audio.paused) {
      try {
        await audio.play();
        toast('🎵 Hörnflagga, hörn-flagga. Plan B-låten är på!');
      } catch (e) {
        toast('⚠️ Kunde inte spela låten — webbläsaren blockerade. Klicka igen.');
      }
    } else {
      audio.pause();
    }
  };

  playBtn.addEventListener('click', togglePlay);
  if (heroBtn) heroBtn.addEventListener('click', togglePlay);

  audio.addEventListener('play', updatePlayState);
  audio.addEventListener('pause', updatePlayState);
  audio.addEventListener('ended', updatePlayState);

  audio.addEventListener('timeupdate', () => {
    timeEl.textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;
  });
  audio.addEventListener('loadedmetadata', () => {
    timeEl.textContent = `0:00 / ${fmt(audio.duration)}`;
  });

  volume.addEventListener('input', () => {
    audio.volume = (parseInt(volume.value) || 0) / 100;
  });

  closeBtn.addEventListener('click', () => {
    audio.pause();
    audio.currentTime = 0;
    player.hidden = true;
    updatePlayState();
  });
}

// ---------- Reset ----------
function initReset() {
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('🧨 Säker? Detta raderar ALLT (spelare, grupper, matcher, resultat). Det går inte att ångra.')) return;
    if (!confirm('Helt säker? Sista chansen.')) return;
    localStorage.removeItem(STORAGE_KEY);
    state = structuredClone(defaultState);
    renderAll();
    toast('🧨 Allt rivet. Nu börjar vi om.');
    $('.tab[data-tab="hem"]').click();
  });
}

// ---------- Master render ----------
function renderAll() {
  renderDashboard();
  renderPlayers();
  renderGroups();
  renderSchedule();
  renderKnockout();
  renderStats();
}

// ---------- Sync (Firebase live-sync, optional) ----------
function initSync() {
  const pill = $('#syncStatus');
  if (!pill) return;

  const apply = (s) => {
    pill.classList.remove('off', 'connecting', 'live', 'error');
    pill.classList.add(s.status);
    const labels = {
      off: '⚪ Lokal',
      connecting: 'Kopplar upp…',
      live: `Live · ${window.TOURNAMENT_ID || 'default'}`,
      error: 'Sync-fel',
    };
    pill.textContent = labels[s.status] || s.status;
    pill.title = s.info || '';
  };

  // Lyssna på status från sync.js
  window.addEventListener('planb:sync-status', e => apply(e.detail));

  // Hantera incoming state från andra enheter
  if (window.PlanBSync) {
    if (window.PlanBSync.status) apply({ status: window.PlanBSync.status });
    if (window.PlanBSync.onRemote) {
      window.PlanBSync.onRemote(remoteState => {
        if (!remoteState) return;
        // Slå ihop nya defaults så fält som lagts till senare inte saknas
        state = { ...structuredClone(defaultState), ...remoteState };
        state.settings = { ...defaultState.settings, ...(remoteState.settings || {}) };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        renderAll();
        toast('🔄 Uppdaterat från en annan enhet.');
      });
    }
  }
}

// ---------- Init ----------
function init() {
  initTabs();
  initPlayers();
  initSchedule();
  initModal();
  initPlayerModal();
  initKnockout();
  initAudio();
  initReset();
  initSync();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
