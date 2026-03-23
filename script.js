document.addEventListener('DOMContentLoaded', () => {

let teams         = [];
let matches       = [];
let activeMatchId = null;
let editTeamId    = null;
let pendingWicket = null;

const save = () => {
  localStorage.setItem('ctm_teams',   JSON.stringify(teams));
  localStorage.setItem('ctm_matches', JSON.stringify(matches));
  if (activeMatchId) localStorage.setItem('ctm_activeMatch', activeMatchId);
  else               localStorage.removeItem('ctm_activeMatch');
};

const load = () => {
  teams         = JSON.parse(localStorage.getItem('ctm_teams')   || '[]');
  matches       = JSON.parse(localStorage.getItem('ctm_matches') || '[]');
  activeMatchId = localStorage.getItem('ctm_activeMatch') || null;
  matches.forEach(m => m.innings?.forEach(inn => {
    inn.ballLog     = (inn.ballLog     || []).map(normaliseBall);
    inn.currentOver = (inn.currentOver || []).map(normaliseBall);
    inn.overLog     = (inn.overLog     || []).map(over => over.map(normaliseBall));
    Object.values(inn.batting || {}).forEach(b => {
      if (!('dismissal' in b)) b.dismissal = null;
    });
  }));
};

function normaliseBall(b) {
  if (b && typeof b === 'object') return b;       
  if (b === 'W')  return { type: 'wicket', kind: 'bowled', bowler: '', fielder: null };
  if (b === 'WD') return { type: 'extra',  kind: 'wide',   value: 1 };
  if (b === 'NB') return { type: 'extra',  kind: 'noball', value: 1 };
  if (typeof b === 'string' && b.startsWith('B'))
    return { type: 'extra', kind: 'bye', value: parseInt(b.slice(1), 10) || 1 };
  return { type: 'run', value: typeof b === 'number' ? b : parseInt(b, 10) || 0 };
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const toastEl = document.getElementById('toast');
let toastTimer;
function showToast(msg, type = 'success') {
  toastEl.textContent = msg;
  toastEl.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.className = 'toast hidden', 2800);
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    if (tab === 'live')        renderLive();
    if (tab === 'history')     renderHistory();
    if (tab === 'leaderboard') renderLeaderboard();
  });
});

function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }


function renderTeams() {
  const grid  = document.getElementById('teamsGrid');
  const empty = document.getElementById('teamsEmpty');
  grid.querySelectorAll('.team-card').forEach(c => c.remove());
  if (teams.length === 0) { empty.style.display = ''; return; }
  empty.style.display = 'none';
  teams.forEach(team => {
    const card = document.createElement('div');
    card.className = 'team-card';
    card.innerHTML = `
      <div class="team-card-header">
        <span class="team-card-name">${escHtml(team.name)}</span>
        <div class="team-card-actions">
          <button class="icon-btn edit-team"   data-id="${team.id}" title="Edit">✏️</button>
          <button class="icon-btn delete delete-team" data-id="${team.id}" title="Delete">🗑️</button>
        </div>
      </div>
      <div class="team-player-count">${team.players.length} players</div>
      <div class="player-chips">
        ${team.players.map(p => `<span class="player-chip">${escHtml(p)}</span>`).join('')}
      </div>`;
    grid.appendChild(card);
  });
}

document.getElementById('openAddTeamModal').addEventListener('click', () => {
  editTeamId = null;
  document.getElementById('teamModalTitle').textContent = 'Create Team';
  document.getElementById('teamNameInput').value = '';
  const container = document.getElementById('playerInputsContainer');
  container.innerHTML = '';
  for (let i = 0; i < 5; i++) addPlayerInput(container, '');
  openModal('teamModal');
});

document.getElementById('teamsGrid').addEventListener('click', e => {
  if (e.target.classList.contains('edit-team')) {
    const id   = e.target.dataset.id;
    const team = teams.find(t => t.id === id);
    if (!team) return;
    editTeamId = id;
    document.getElementById('teamModalTitle').textContent = 'Edit Team';
    document.getElementById('teamNameInput').value = team.name;
    const container = document.getElementById('playerInputsContainer');
    container.innerHTML = '';
    team.players.forEach(p => addPlayerInput(container, p));
    openModal('teamModal');
  }
  if (e.target.classList.contains('delete-team')) {
    const id = e.target.dataset.id;
    if (!confirm('Delete this team? Matches using this team will be removed.')) return;
    teams   = teams.filter(t => t.id !== id);
    matches = matches.filter(m => m.teamAId !== id && m.teamBId !== id);
    save(); renderTeams(); renderMatches();
    showToast('Team deleted.', 'error');
  }
});

function addPlayerInput(container, value = '') {
  const row = document.createElement('div');
  row.className = 'player-input-row';
  row.innerHTML = `
    <input type="text" placeholder="Player name" value="${escHtml(value)}" maxlength="40"/>
    <button class="remove-player-btn" title="Remove">✕</button>`;
  row.querySelector('.remove-player-btn').addEventListener('click', () => row.remove());
  container.appendChild(row);
}
document.getElementById('addPlayerInputBtn').addEventListener('click', () =>
  addPlayerInput(document.getElementById('playerInputsContainer')));

document.getElementById('saveTeamBtn').addEventListener('click', () => {
  const name    = document.getElementById('teamNameInput').value.trim();
  if (!name) return showToast('Team name required.', 'error');
  const inputs  = document.querySelectorAll('#playerInputsContainer .player-input-row input');
  const players = [...inputs].map(i => i.value.trim()).filter(Boolean);
  if (players.length < 5) return showToast('Minimum 5 players required.', 'error');
  if (editTeamId) {
    const team = teams.find(t => t.id === editTeamId);
    team.name = name; team.players = players;
    showToast(`Team "${name}" updated!`);
  } else {
    teams.push({ id: uid(), name, players });
    showToast(`Team "${name}" created!`);
  }
  save(); renderTeams(); closeModal('teamModal');
});
document.getElementById('closeTeamModal').addEventListener('click',  () => closeModal('teamModal'));
document.getElementById('cancelTeamModal').addEventListener('click', () => closeModal('teamModal'));


function renderMatches() {
  const list  = document.getElementById('matchesList');
  const empty = document.getElementById('matchesEmpty');
  list.querySelectorAll('.match-card').forEach(c => c.remove());
  if (matches.length === 0) { empty.style.display = ''; return; }
  empty.style.display = 'none';

  [...matches].reverse().forEach(match => {
    const tA = getTeam(match.teamAId);
    const tB = getTeam(match.teamBId);
    if (!tA || !tB) return;
    const card = document.createElement('div');
    card.className = 'match-card';
    const statusClass = {
      upcoming:'status-upcoming', live:'status-live', completed:'status-completed'
    }[match.status] || '';
    const statusLabel = match.status.charAt(0).toUpperCase() + match.status.slice(1);
    card.innerHTML = `
      <div class="match-teams">
        <div class="match-vs">
          <span>${escHtml(tA.name)}</span>
          <span class="vs-sep">vs</span>
          <span>${escHtml(tB.name)}</span>
        </div>
        <div class="match-overs-info">${match.overs} overs per side</div>
        ${match.result ? `<div class="history-result" style="margin-top:.4rem">${escHtml(match.result)}</div>` : ''}
      </div>
      <span class="match-status ${statusClass}">${statusLabel}</span>
      <div class="match-actions">
        ${match.status !== 'completed'
          ? `<button class="btn btn-primary go-live-btn" data-id="${match.id}">▶ Score</button>`
          : ''}
        <button class="btn btn-danger del-match-btn" data-id="${match.id}">🗑</button>
      </div>`;
    list.appendChild(card);
  });
}

document.getElementById('matchesList').addEventListener('click', e => {
  if (e.target.classList.contains('go-live-btn')) {
    activeMatchId = e.target.dataset.id;
    save();
    document.querySelectorAll('.nav-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === 'live'));
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    document.getElementById('tab-live').classList.add('active');
    renderLive();
  }
  if (e.target.classList.contains('del-match-btn')) {
    if (!confirm('Delete this match?')) return;
    const id = e.target.dataset.id;
    matches = matches.filter(m => m.id !== id);
    if (activeMatchId === id) activeMatchId = null;
    save(); renderMatches();
    showToast('Match deleted.', 'error');
  }
});

document.getElementById('openCreateMatchModal').addEventListener('click', () => {
  if (teams.length < 2) return showToast('Need at least 2 teams first.', 'error');
  populateTeamSelects();
  openModal('matchModal');
});
document.getElementById('closeMatchModal').addEventListener('click',  () => closeModal('matchModal'));
document.getElementById('cancelMatchModal').addEventListener('click', () => closeModal('matchModal'));

function populateTeamSelects() {
  ['matchTeamA','matchTeamB'].forEach(selId => {
    document.getElementById(selId).innerHTML =
      teams.map(t => `<option value="${t.id}">${escHtml(t.name)}</option>`).join('');
  });
  if (teams.length >= 2) document.getElementById('matchTeamB').selectedIndex = 1;
}

document.getElementById('saveMatchBtn').addEventListener('click', () => {
  const tAId  = document.getElementById('matchTeamA').value;
  const tBId  = document.getElementById('matchTeamB').value;
  const overs = parseInt(document.getElementById('matchOvers').value, 10);
  if (tAId === tBId)       return showToast('Select two different teams.', 'error');
  if (!overs || overs < 1) return showToast('Enter valid overs (min 1).', 'error');
  matches.push({
    id: uid(), teamAId: tAId, teamBId: tBId, overs,
    status: 'upcoming', toss: null, mom: null,
    innings: [], currentInnings: 0, result: null
  });
  save(); renderMatches(); closeModal('matchModal');
  showToast('Match created!');
});

function getTeam(id)  { return teams.find(t => t.id === id)   || null; }
function getMatch(id) { return matches.find(m => m.id === id) || null; }

function playerKey(teamId, name) { return `${teamId}_${name}`; }

function keyToName(key) { return key.split('_').slice(1).join('_'); }

function formatOvers(balls) { return `${Math.floor(balls / 6)}.${balls % 6}`; }

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function dismissalText(stat) {
  if (!stat.out || !stat.dismissal) return stat.out ? 'out' : '';
  const d = stat.dismissal;
  const b = d.bowler   ? keyToName(d.bowler)  : '';
  const f = d.fielder  ? keyToName(d.fielder) : '';
  switch (d.kind) {
    case 'bowled':    return b ? `b ${b}`            : 'bowled';
    case 'caught':    return f ? `c ${f} b ${b}`     : `c & b ${b}`;
    case 'lbw':       return b ? `lbw b ${b}`        : 'lbw';
    case 'runout':    return f ? `run out (${f})`    : 'run out';
    case 'stumped':   return f ? `st ${f} b ${b}`    : `st b ${b}`;
    case 'hitwicket': return b ? `hit wicket b ${b}` : 'hit wicket';
    default:          return d.kind || 'out';
  }
}

function ballClass(b) {
  if (!b || typeof b !== 'object') return 'dot'; 
  if (b.type === 'wicket') return 'wicket';
  if (b.type === 'extra')  return `extra ${b.kind}`;
  if (b.type === 'run') {
    if (b.value === 4) return 'four';
    if (b.value === 6) return 'six';
    if (b.value === 0) return 'dot';
    return 'run';
  }
  return 'dot';
}

function ballLabel(b) {
  if (!b || typeof b !== 'object') return '?';
  if (b.type === 'wicket') return 'W';
  if (b.type === 'extra') {
    const map = { wide:'Wd', noball:'Nb', bye:`B${b.value}` };
    return map[b.kind] || b.kind;
  }
  return String(b.value);
}

function newInnings(battingTeamId, bowlingTeamId) {
  return {
    battingTeamId, bowlingTeamId,
    runs: 0, wickets: 0, balls: 0,
    extras: { wides: 0, noBalls: 0, byes: 0 },
    ballLog: [], overLog: [], currentOver: [],
    target: null,
    batting: {}, bowling: {},
    striker: '', nonStriker: '', bowler: '',
    playersSet: false, complete: false
  };
}

function currentInnings(match) { return match.innings[match.currentInnings] || null; }


function renderLive() {
  const noMatch = document.getElementById('liveNoMatch');
  const board   = document.getElementById('liveScoreboard');

  if (!activeMatchId) {
    noMatch.classList.remove('hidden'); board.classList.add('hidden'); return;
  }
  const match = getMatch(activeMatchId);
  if (!match || match.status === 'completed') {
    noMatch.classList.remove('hidden'); board.classList.add('hidden');
    if (match?.status === 'completed')
      noMatch.querySelector('p').textContent = 'Match completed. See History tab.';
    return;
  }

  noMatch.classList.add('hidden');
  board.classList.remove('hidden');

  const tA = getTeam(match.teamAId);
  const tB = getTeam(match.teamBId);
  document.getElementById('liveMatchTitle').textContent = `${tA.name} vs ${tB.name}`;

  const tossRow    = document.getElementById('tossRow');
  const tossChoice = document.getElementById('tossChoice');
  const tossResult = document.getElementById('tossResult');

  if (!match.toss) {
    tossRow.classList.remove('hidden');
    tossChoice.classList.add('hidden');
    tossResult.textContent = '';
  } else if (match.toss.choice === null) {
    tossRow.classList.remove('hidden');
    tossChoice.classList.remove('hidden');
    document.getElementById('tossChoicePrompt').textContent =
      `${getTeam(match.toss.winnerId).name} won the toss! Choose:`;
    tossResult.textContent = '';
  } else {
    tossRow.classList.remove('hidden');
    tossChoice.classList.add('hidden');
    tossResult.textContent =
      `${getTeam(match.toss.winnerId).name} won the toss & elected to ${match.toss.choice}`;
  }

  if (match.toss && match.toss.choice !== null && match.innings.length === 0) {
    const battingId = match.toss.choice === 'bat'
      ? match.toss.winnerId
      : (match.toss.winnerId === match.teamAId ? match.teamBId : match.teamAId);
    const bowlingId = battingId === match.teamAId ? match.teamBId : match.teamAId;
    match.innings.push(newInnings(battingId, bowlingId));
    match.status = 'live';
    save();
  }

  const inn = currentInnings(match);
  if (!inn) return;

  document.getElementById('inningsNum').textContent = match.currentInnings + 1;
  document.getElementById('battingTeamLabel').textContent =
    (getTeam(inn.battingTeamId)?.name || '?') + ' (Batting)';
  document.getElementById('bowlingTeamLabel').textContent =
    (getTeam(inn.bowlingTeamId)?.name || '?') + ' (Bowling)';
  document.getElementById('scoreRuns').textContent    = inn.runs;
  document.getElementById('scoreWickets').textContent = inn.wickets;
  document.getElementById('scoreOvers').textContent   = formatOvers(inn.balls);

  const crr = inn.balls > 0 ? (inn.runs / (inn.balls / 6)).toFixed(2) : '0.00';
  document.getElementById('currRunRate').textContent = crr;

  const targetDisplay = document.getElementById('targetDisplay');
  if (inn.target) {
    targetDisplay.classList.remove('hidden');
    document.getElementById('targetRuns').textContent = inn.target;
  } else {
    targetDisplay.classList.add('hidden');
  }

  const overContainer = document.getElementById('currentOverBalls');
  overContainer.innerHTML = '';
  inn.currentOver.forEach(b => {
    const chip = document.createElement('div');
    chip.className = 'ball-chip ' + ballClass(b);
    chip.textContent = ballLabel(b);
    overContainer.appendChild(chip);
  });
  document.getElementById('overRuns').textContent =
    inn.currentOver.reduce((s, b) => {
      if (b.type === 'extra') return s + (b.value || 1);
      if (b.type === 'wicket') return s;
      return s + (b.value || 0);
    }, 0);

  renderBattingStats(inn);
  renderBowlingStats(inn);

  const selPanel = document.getElementById('playerSelection');
  if (!inn.playersSet) {
    selPanel.classList.remove('hidden');
    populatePlayerSelects(inn, match);
  } else {
    selPanel.classList.add('hidden');
  }

  document.querySelectorAll(
    '.score-btn, #addManualRuns, #endInningsBtn, #undoLastBallBtn, #extraWideBtn, #extraNoBallBtn, #extraByeBtn'
  ).forEach(el => { el.disabled = !inn.playersSet; });
}

function populatePlayerSelects(inn, match) {
  const battingTeam = getTeam(inn.battingTeamId);
  const bowlingTeam = getTeam(inn.bowlingTeamId);
  if (!battingTeam || !bowlingTeam) return;

  const strikerSel    = document.getElementById('selectStriker');
  const nonStrikerSel = document.getElementById('selectNonStriker');
  const bowlerSel     = document.getElementById('selectBowler');

  const availableBatters = battingTeam.players.filter(p => {
    const k = playerKey(inn.battingTeamId, p);
    return !inn.batting[k]?.out;
  });

  const bOpts = availableBatters.map(p => {
    const key = playerKey(inn.battingTeamId, p);
    return `<option value="${escHtml(key)}"${key === inn.striker ? ' selected' : ''}>${escHtml(p)}</option>`;
  }).join('');
  const wOpts = bowlingTeam.players.map(p => {
    const key = playerKey(inn.bowlingTeamId, p);
    return `<option value="${escHtml(key)}"${key === inn.bowler ? ' selected' : ''}>${escHtml(p)}</option>`;
  }).join('');

  strikerSel.innerHTML    = bOpts;
  nonStrikerSel.innerHTML = bOpts;
  bowlerSel.innerHTML     = wOpts;

  if (!inn.nonStriker && availableBatters.length > 1)
    nonStrikerSel.selectedIndex = 1;
  else if (inn.nonStriker)
    nonStrikerSel.value = inn.nonStriker;
}

document.getElementById('confirmPlayersBtn').addEventListener('click', () => {
  const match = getMatch(activeMatchId); if (!match) return;
  const inn   = currentInnings(match);  if (!inn)   return;
  const s  = document.getElementById('selectStriker').value;
  const ns = document.getElementById('selectNonStriker').value;
  const b  = document.getElementById('selectBowler').value;
  if (!s || !ns || !b)  return showToast('Select all three players.', 'error');
  if (s === ns)         return showToast('Striker & Non-striker must be different.', 'error');
  inn.striker = s; inn.nonStriker = ns; inn.bowler = b; inn.playersSet = true;
  [s, ns].forEach(key => {
    if (!inn.batting[key])
      inn.batting[key] = { runs:0, balls:0, fours:0, sixes:0, out:false, dismissal:null };
  });
  if (!inn.bowling[b])
    inn.bowling[b] = { balls:0, overs:0, runs:0, wickets:0 };
  save(); renderLive();
});

let isFlipping = false;

function performToss() {
  const match = getMatch(activeMatchId);
  if (!match) return;
  // Only block re-toss once innings have actually started
  if (match.innings.length > 0) return showToast('Toss already done — match has started!');
  if (isFlipping) return;

  const coin = document.getElementById('coin');
  const tossBtn = document.getElementById('tossBtn');

  // Reset any previous toss state before flipping again
  match.toss = null;
  document.getElementById('tossChoice').classList.add('hidden');
  document.getElementById('tossResult').textContent = '';

  isFlipping = true;
  tossBtn.disabled = true;

  const isHeads = Math.random() < 0.5;

  coin.classList.remove('flip-heads', 'flip-tails');

  setTimeout(() => {
    coin.classList.add(isHeads ? 'flip-heads' : 'flip-tails');
  }, 100);

  setTimeout(() => {
    // Randomly pick winner — not tied to heads/tails, fully random each time
    const winnerIndex = Math.random() < 0.5 ? match.teamAId : match.teamBId;

    match.toss = {
      winnerId: winnerIndex,
      choice: null
    };

    save();

    const tossChoice = document.getElementById('tossChoice');
    tossChoice.classList.remove('hidden');

    document.getElementById('tossChoicePrompt').textContent =
      `${getTeam(winnerIndex).name} won the toss! Choose:`;

    document.getElementById('tossResult').textContent = '';

    tossBtn.disabled = false;
    isFlipping = false;

  }, 1500);
}

document.getElementById('tossBtn').addEventListener('click', performToss);


document.querySelector('.coin-container').addEventListener('click', performToss);
document.getElementById('chooseBat').addEventListener('click',  () => applyTossChoice('bat'));
document.getElementById('chooseBowl').addEventListener('click', () => applyTossChoice('bowl'));
function applyTossChoice(choice) {
  const match = getMatch(activeMatchId);
  if (!match || !match.toss) return;
  match.toss.choice = choice;
  save(); renderLive();
}


document.querySelectorAll('.wicket-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const match = getMatch(activeMatchId); if (!match) return;
    const inn   = currentInnings(match);
    if (!inn || !inn.playersSet || inn.complete) return;

    const kind = btn.dataset.kind; 
    pendingWicket = { match, inn, kind };

    document.getElementById('wicketModalTitle').textContent =
      kind.charAt(0).toUpperCase() + kind.slice(1).replace('wicket',' Wicket');

    
    const fielderBlock = document.getElementById('wicketFielderBlock');
    const fielderSel   = document.getElementById('wicketFielderSelect');
    const needsFielder = ['caught','runout','stumped'].includes(kind);

    if (needsFielder) {
      fielderBlock.classList.remove('hidden');
      const fieldingTeam = getTeam(inn.bowlingTeamId);
      fielderSel.innerHTML = fieldingTeam.players
        .map(p => {
          const key = playerKey(inn.bowlingTeamId, p);
          return `<option value="${escHtml(key)}">${escHtml(p)}</option>`;
        }).join('');
    } else {
      fielderBlock.classList.add('hidden');
    }

    openModal('wicketModal');
  });
});


document.getElementById('confirmWicketBtn').addEventListener('click', () => {
  if (!pendingWicket) return;
  const { match, inn, kind } = pendingWicket;
  const needsFielder = ['caught','runout','stumped'].includes(kind);
  const fielderKey   = needsFielder
    ? document.getElementById('wicketFielderSelect').value
    : null;

 
  const ballObj = {
    type:    'wicket',
    kind,
    bowler:  inn.bowler,
    fielder: fielderKey || null
  };

  closeModal('wicketModal');
  pendingWicket = null;
  commitWicket(match, inn, ballObj);
});

document.getElementById('cancelWicketBtn').addEventListener('click', () => {
  pendingWicket = null;
  closeModal('wicketModal');
});
document.getElementById('closeWicketModal').addEventListener('click', () => {
  pendingWicket = null;
  closeModal('wicketModal');
});

function commitWicket(match, inn, ballObj) {
  inn.balls++;
  inn.wickets++;
  inn.ballLog.push(ballObj);
  inn.currentOver.push(ballObj);

  const batterKey = inn.striker;
  const batter = inn.batting[batterKey] ||
    (inn.batting[batterKey] = { runs:0, balls:0, fours:0, sixes:0, out:false, dismissal:null });
  batter.balls++;
  batter.out = true;
  batter.dismissal = {
    kind:    ballObj.kind,
    bowler:  ballObj.bowler,
    fielder: ballObj.fielder
  };

  const bowlerKey = inn.bowler;
  const bowler = inn.bowling[bowlerKey] ||
    (inn.bowling[bowlerKey] = { balls:0, overs:0, runs:0, wickets:0 });
  bowler.balls++;
  if (ballObj.kind !== 'runout') bowler.wickets++;
  bowler.overs = Math.floor(bowler.balls / 6);

  if (inn.balls % 6 === 0) {
    inn.overLog.push([...inn.currentOver]);
    inn.currentOver = [];
    [inn.striker, inn.nonStriker] = [inn.nonStriker, inn.striker];
    inn.playersSet = false;
  }

  const maxWickets = (getTeam(inn.battingTeamId)?.players.length ?? 11) - 1;
  if (inn.wickets >= maxWickets || inn.balls >= match.overs * 6) {
    endInnings(match, inn); return;
  }
  if (inn.target && inn.runs >= inn.target) {
    endInnings(match, inn, true); return;
  }

  inn.playersSet = false;
  save(); renderLive();
}

document.querySelectorAll('.score-btn:not(.wicket-type-btn)').forEach(btn => {
  btn.addEventListener('click', () => {
    const val = parseInt(btn.dataset.val, 10);
    if (!isNaN(val)) addBall(val);
  });
});

document.getElementById('manualRuns').setAttribute('max', '6');
document.getElementById('addManualRuns').addEventListener('click', () => {
  const raw = parseInt(document.getElementById('manualRuns').value, 10);
  if (isNaN(raw) || raw < 0 || raw > 6)
    return showToast('Manual runs must be 0–6.', 'error');
  addBall(raw);
  document.getElementById('manualRuns').value = '';
});

document.getElementById('extraWideBtn').addEventListener('click',   () => addExtra('wide'));
document.getElementById('extraNoBallBtn').addEventListener('click', () => addExtra('noball'));
document.getElementById('extraByeBtn').addEventListener('click', () => {
  const v = Math.min(Math.max(parseInt(document.getElementById('byeRunsInput').value,10)||1,1),4);
  addExtra('bye', v);
});

function addBall(value) {
  const match = getMatch(activeMatchId); if (!match) return;
  const inn   = currentInnings(match);
  if (!inn || !inn.playersSet || inn.complete) return;

  const ballObj = { type: 'run', value };

  inn.runs  += value;
  inn.balls += 1;
  inn.ballLog.push(ballObj);
  inn.currentOver.push(ballObj);

  const batterKey = inn.striker;
  const batter = inn.batting[batterKey] ||
    (inn.batting[batterKey] = { runs:0, balls:0, fours:0, sixes:0, out:false, dismissal:null });
  batter.balls++;
  batter.runs += value;
  if (value === 4) batter.fours++;
  if (value === 6) batter.sixes++;

  const bowlerKey = inn.bowler;
  const bowler = inn.bowling[bowlerKey] ||
    (inn.bowling[bowlerKey] = { balls:0, overs:0, runs:0, wickets:0 });
  bowler.balls++;
  bowler.runs += value;
  bowler.overs = Math.floor(bowler.balls / 6);

  if (value % 2 !== 0) [inn.striker, inn.nonStriker] = [inn.nonStriker, inn.striker];

  if (inn.balls % 6 === 0) {
    inn.overLog.push([...inn.currentOver]);
    inn.currentOver = [];
    [inn.striker, inn.nonStriker] = [inn.nonStriker, inn.striker];
    inn.playersSet = false;
  }

  const maxWickets = (getTeam(inn.battingTeamId)?.players.length ?? 11) - 1;
  if (inn.wickets >= maxWickets || inn.balls >= match.overs * 6) {
    endInnings(match, inn); return;
  }
  if (inn.target && inn.runs >= inn.target) {
    endInnings(match, inn, true); return;
  }

  save(); renderLive();
}

function addExtra(kind, value = 1) {
  const match = getMatch(activeMatchId); if (!match) return;
  const inn   = currentInnings(match);
  if (!inn || !inn.playersSet || inn.complete) return;
  if (!inn.extras) inn.extras = { wides:0, noBalls:0, byes:0 };

  const ballObj = { type: 'extra', kind, value };
  inn.ballLog.push(ballObj);
  inn.currentOver.push(ballObj);

  if (kind === 'wide') {
    inn.runs++;
    inn.extras.wides++;
  } else if (kind === 'noball') {
    inn.runs++;
    inn.extras.noBalls++;
  } else if (kind === 'bye') {
    inn.runs  += value;
    inn.balls++;           
    inn.extras.byes += value;
    if (inn.balls % 6 === 0) {
      inn.overLog.push([...inn.currentOver]);
      inn.currentOver = [];
      [inn.striker, inn.nonStriker] = [inn.nonStriker, inn.striker];
      inn.playersSet = false;
    }
  }

  save(); renderLive();
}

document.getElementById('undoLastBallBtn').addEventListener('click', () => {
  const match = getMatch(activeMatchId); if (!match) return;
  const inn   = currentInnings(match);
  if (!inn || inn.ballLog.length === 0) return showToast('Nothing to undo.', 'error');

  const undone = inn.ballLog.pop();

  inn.runs = 0; inn.wickets = 0; inn.balls = 0;
  inn.currentOver = []; inn.overLog = [];
  inn.extras = { wides:0, noBalls:0, byes:0 };

  Object.keys(inn.batting).forEach(k =>
    (inn.batting[k] = { runs:0, balls:0, fours:0, sixes:0, out:false, dismissal:null }));
  Object.keys(inn.bowling).forEach(k =>
    (inn.bowling[k] = { balls:0, overs:0, runs:0, wickets:0 }));

  inn.ballLog.forEach(b => {
    if (b.type === 'wicket') {
      inn.balls++; inn.wickets++;
    } else if (b.type === 'extra') {
      if (b.kind === 'wide')   { inn.runs++;        inn.extras.wides++; }
      if (b.kind === 'noball') { inn.runs++;        inn.extras.noBalls++; }
      if (b.kind === 'bye')    { inn.runs += b.value; inn.balls++; inn.extras.byes += b.value; }
    } else {
      inn.runs  += b.value || 0;
      inn.balls += 1;
    }
    inn.currentOver.push(b);
    const legalBall = b.type !== 'extra' || b.kind === 'bye';
    if (legalBall && inn.balls % 6 === 0) {
      inn.overLog.push([...inn.currentOver]);
      inn.currentOver = [];
    }
  });

  inn.playersSet = false;
  const label = undone.type === 'wicket'
    ? `W (${undone.kind})`
    : undone.type === 'extra' ? `${undone.kind}` : String(undone.value);
  showToast(`Undid: ${label}`);
  save(); renderLive();
});

document.getElementById('endInningsBtn').addEventListener('click', () => {
  const match = getMatch(activeMatchId); if (!match) return;
  const inn   = currentInnings(match);  if (!inn)   return;
  if (!confirm('End this innings now?')) return;
  endInnings(match, inn);
});
function endInnings(match, inn, chaseWon = false) {
  inn.complete = true;
  inn.overLog.push([...inn.currentOver]);
  inn.currentOver = [];

  if (match.currentInnings === 0) {
    const target = inn.runs + 1;
    const inn2   = newInnings(inn.bowlingTeamId, inn.battingTeamId);
    inn2.target  = target;
    match.innings.push(inn2);
    match.currentInnings = 1;
    save(); renderLive();
    showToast(`Innings 1 complete! Target: ${target}`);
  } else {
    match.status = 'completed';
    const inn1  = match.innings[0];
    const inn2  = match.innings[1];
    const tBat1 = getTeam(inn1.battingTeamId).name;
    const tBat2 = getTeam(inn2.battingTeamId).name;
    const maxW  = (getTeam(inn2.battingTeamId)?.players.length ?? 11) - 1;

    if (chaseWon) {
      const wLeft = maxW - inn2.wickets;
      match.result = `${tBat2} won by ${wLeft} wicket${wLeft !== 1 ? 's' : ''}`;
    } else if (inn2.runs >= inn1.runs + 1) {
      match.result = `${tBat2} won`;
    } else if (inn1.runs > inn2.runs) {
      const diff = inn1.runs - inn2.runs;
      match.result = `${tBat1} won by ${diff} run${diff !== 1 ? 's' : ''}`;
    } else {
      match.result = 'Match Tied!';
    }

    match.mom = calcMOM(match);

    activeMatchId = null;
    save(); renderLive(); renderMatches();
    showToast(`Match complete! ${match.result}`);
  }
}

function calcMOM(match) {
  const scores = {}; 

  match.innings.forEach(inn => {
    const battingTeamName = getTeam(inn.battingTeamId)?.name || '?';
    Object.entries(inn.batting).forEach(([key, s]) => {
      if (!scores[key]) scores[key] = { name: keyToName(key), teamName: battingTeamName, runs:0, wickets:0 };
      scores[key].runs += s.runs;
    });
    const bowlingTeamName = getTeam(inn.bowlingTeamId)?.name || '?';
    Object.entries(inn.bowling).forEach(([key, s]) => {
      if (!scores[key]) scores[key] = { name: keyToName(key), teamName: bowlingTeamName, runs:0, wickets:0 };
      scores[key].wickets += s.wickets;
    });
  });

  let best = null;
  Object.values(scores).forEach(p => {
    p.score = p.runs + p.wickets * 20;
    if (!best || p.score > best.score) best = p;
  });
  return best;
}

function renderBattingStats(inn) {
  const tbody = document.getElementById('battingStatsBody');
  tbody.innerHTML = '';
  Object.entries(inn.batting).forEach(([key, s]) => {
    const name      = keyToName(key);
    const sr        = s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(0) : '—';
    const isBatting = (key === inn.striker || key === inn.nonStriker) && !s.out;
    const dis = s.out ? `<span class="dismissal-text">${escHtml(dismissalText(s))}</span>` : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="${isBatting ? 'player-batting' : ''}">
        ${escHtml(name)}${isBatting ? ' <span class="batting-marker">*</span>' : ''} ${dis}
      </td>
      <td>${s.runs}</td><td>${s.balls}</td>
      <td>${s.fours}</td><td>${s.sixes}</td><td>${sr}</td>`;
    tbody.appendChild(tr);
  });
}
function renderBowlingStats(inn) {
  const tbody = document.getElementById('bowlingStatsBody');
  tbody.innerHTML = '';
  Object.entries(inn.bowling).forEach(([key, s]) => {
    const name      = keyToName(key);
    const isBowling = key === inn.bowler;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="${isBowling ? 'player-bowling' : ''}">${escHtml(name)}</td>
      <td>${formatOvers(s.balls || 0)}</td>
      <td>${s.runs}</td><td>${s.wickets}</td>`;
    tbody.appendChild(tr);
  });
}


function renderHistory() {
  const list  = document.getElementById('historyList');
  const empty = document.getElementById('historyEmpty');
  list.querySelectorAll('.history-card').forEach(c => c.remove());

  const completed = matches.filter(m => m.status === 'completed').reverse();
  if (completed.length === 0) { empty.style.display = ''; return; }
  empty.style.display = 'none';

  completed.forEach(match => {
    const tA = getTeam(match.teamAId);
    const tB = getTeam(match.teamBId);
    if (!tA || !tB) return;

    const card = document.createElement('div');
    card.className = 'history-card';

    const momHtml = match.mom
      ? `<div class="mom-badge">🏅 Man of the Match: <strong>${escHtml(match.mom.name)}</strong>
           <span class="mom-detail">(${match.mom.runs} runs, ${match.mom.wickets} wkts)</span></div>`
      : '';

    let summaryHtml = '';
    match.innings.forEach((inn, i) => {
      const bat = getTeam(inn.battingTeamId)?.name || '?';
      summaryHtml += `<div class="innings-line">Innings ${i+1}: ${escHtml(bat)} — ${inn.runs}/${inn.wickets} (${formatOvers(inn.balls)} ov)</div>`;
    });

    const scorecardHtml = buildScorecardHtml(match);

    card.innerHTML = `
      <div class="history-card-header" data-matchid="${match.id}">
        <div class="history-title-row">
          <span class="history-title">${escHtml(tA.name)} vs ${escHtml(tB.name)}</span>
          <button class="btn btn-ghost expand-scorecard-btn" data-matchid="${match.id}">▼ Full Scorecard</button>
        </div>
        <div class="history-result">${escHtml(match.result || '—')}</div>
        ${momHtml}
        <div class="innings-summary">${summaryHtml}</div>
        <div class="history-meta">${match.overs} overs | ID: ${match.id}</div>
      </div>
      <div class="scorecard-body hidden" id="sc-${match.id}">
        ${scorecardHtml}
      </div>`;
    list.appendChild(card);
  });

  list.querySelectorAll('.expand-scorecard-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id   = btn.dataset.matchid;
      const body = document.getElementById(`sc-${id}`);
      const collapsed = body.classList.toggle('hidden');
      btn.textContent = collapsed ? '▼ Full Scorecard' : '▲ Hide Scorecard';
    });
  });
}


function buildScorecardHtml(match) {
  let html = '';
  match.innings.forEach((inn, idx) => {
    const batTeam  = getTeam(inn.battingTeamId)?.name || '?';
    const bowlTeam = getTeam(inn.bowlingTeamId)?.name || '?';

    html += `<div class="sc-innings">
      <h4 class="sc-innings-title">Innings ${idx + 1} — ${escHtml(batTeam)}
        <span class="sc-score">${inn.runs}/${inn.wickets} (${formatOvers(inn.balls)} ov)</span>
      </h4>`;

    
    html += `<table class="sc-table">
      <thead><tr>
        <th>Batter</th><th>Dismissal</th>
        <th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th>
      </tr></thead><tbody>`;
    Object.entries(inn.batting).forEach(([key, s]) => {
      const name = keyToName(key);
      const sr   = s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(0) : '—';
      const dis  = s.out ? escHtml(dismissalText(s)) : '<em>not out</em>';
      html += `<tr>
        <td><strong>${escHtml(name)}</strong></td>
        <td class="sc-dismissal">${dis}</td>
        <td>${s.runs}</td><td>${s.balls}</td>
        <td>${s.fours}</td><td>${s.sixes}</td><td>${sr}</td>
      </tr>`;
    });
    
    const ex = inn.extras || {};
    const extrasTotal = (ex.wides||0) + (ex.noBalls||0) + (ex.byes||0);
    html += `<tr class="sc-extras-row">
      <td colspan="2"><em>Extras</em> (wd ${ex.wides||0}, nb ${ex.noBalls||0}, b ${ex.byes||0})</td>
      <td colspan="5">${extrasTotal}</td>
    </tr>`;
    html += `</tbody></table>`;

    html += `<table class="sc-table sc-bowling-table">
      <thead><tr>
        <th>Bowler</th><th>O</th><th>R</th><th>W</th>
      </tr></thead><tbody>`;
    Object.entries(inn.bowling).forEach(([key, s]) => {
      const name = keyToName(key);
      html += `<tr>
        <td><strong>${escHtml(name)}</strong></td>
        <td>${formatOvers(s.balls||0)}</td>
        <td>${s.runs}</td><td>${s.wickets}</td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  });
  return html || '<p style="color:var(--text-muted);padding:1rem">No innings data.</p>';
}


function renderLeaderboard() {
  const runMap    = {};
  const wicketMap = {};

  matches.filter(m => m.status === 'completed').forEach(match => {
    match.innings.forEach(inn => {
      const battingTeamName = getTeam(inn.battingTeamId)?.name || '?';
      Object.entries(inn.batting).forEach(([key, s]) => {
        if (!runMap[key]) runMap[key] = { runs:0, team:battingTeamName, name:keyToName(key) };
        runMap[key].runs += s.runs;
      });
      const bowlingTeamName = getTeam(inn.bowlingTeamId)?.name || '?';
      Object.entries(inn.bowling).forEach(([key, s]) => {
        if (!wicketMap[key]) wicketMap[key] = { wickets:0, team:bowlingTeamName, name:keyToName(key) };
        wicketMap[key].wickets += s.wickets;
      });
    });
  });

  renderLBList(
    document.getElementById('topBatters'),
    Object.values(runMap).sort((a,b) => b.runs - a.runs).slice(0,10),
    v => `${v.runs} runs`
  );
  renderLBList(
    document.getElementById('topBowlers'),
    Object.values(wicketMap).sort((a,b) => b.wickets - a.wickets).slice(0,10),
    v => `${v.wickets} wkts`
  );
}

function renderLBList(container, entries, valFn) {
  container.innerHTML = '';
  if (entries.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:1.5rem"><p>No data yet.</p></div>';
    return;
  }
  entries.forEach((entry, i) => {
    const rankClass = i===0?'gold':i===1?'silver':i===2?'bronze':'';
    const row = document.createElement('div');
    row.className = 'lb-row';
    row.innerHTML = `
      <span class="lb-rank ${rankClass}">#${i+1}</span>
      <span class="lb-name">${escHtml(entry.name)} <span class="lb-team">(${escHtml(entry.team)})</span></span>
      <span class="lb-val">${valFn(entry)}</span>`;
    container.appendChild(row);
  });
}

load();
renderTeams();
renderMatches();

});