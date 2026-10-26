(() => {
  'use strict';
  const KEY = 'metamorpho-mvp-v1';
  const fresh = () => ({ lineup: [], batterIndex: 0, homeScore: 0, awayScore: 0, outs: 0, inning: 1 });
  let state;
  try { state = { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { state = fresh(); }
  if (!Array.isArray(state.lineup)) state.lineup = [];
  const $ = id => document.getElementById(id);
  const save = () => { localStorage.setItem(KEY, JSON.stringify(state)); render(); };
  const snapshots = [];
  const mutate = fn => { snapshots.push(JSON.stringify(state)); if (snapshots.length > 30) snapshots.shift(); fn(); save(); };
  function render() {
    $('rosterCount').textContent = `${state.lineup.length} jugador${state.lineup.length === 1 ? '' : 'es'}`;
    const list = $('lineupList'); list.replaceChildren();
    state.lineup.forEach((name, i) => {
      const li = document.createElement('li'); li.className = 'lineup-item';
      const num = document.createElement('span'); num.className = 'number'; num.textContent = i + 1;
      const label = document.createElement('span'); label.className = 'name'; label.textContent = name;
      li.append(num, label);
      [['↑', () => move(i, -1), i === 0], ['↓', () => move(i, 1), i === state.lineup.length - 1], ['×', () => remove(i), false]].forEach(([symbol, fn, disabled]) => {
        const b = document.createElement('button'); b.className = 'iconbtn' + (symbol === '×' ? ' remove' : ''); b.textContent = symbol; b.disabled = disabled; b.setAttribute('aria-label', symbol === '×' ? `Eliminar ${name}` : `Mover ${name} ${symbol === '↑' ? 'arriba' : 'abajo'}`); b.onclick = fn; li.append(b);
      });
      list.append(li);
    });
    $('emptyLineup').hidden = state.lineup.length > 0;
    $('homeScore').textContent = state.homeScore; $('awayScore').textContent = state.awayScore;
    $('inning').textContent = state.inning;
    $('outsDisplay').textContent = '● '.repeat(state.outs) + '○ '.repeat(3 - state.outs);
    const n = state.lineup.length;
    state.batterIndex = n ? state.batterIndex % n : 0;
    $('currentBatter').textContent = n ? state.lineup[state.batterIndex] : 'Sin jugadores';
    $('nextBatter').textContent = n ? state.lineup[(state.batterIndex + 1) % n] : '—';
    $('nextBatterBtn').disabled = n === 0;
  }
  function move(i, dir) { const j = i + dir; if (j < 0 || j >= state.lineup.length) return; mutate(() => { [state.lineup[i], state.lineup[j]] = [state.lineup[j], state.lineup[i]]; }); }
  function remove(i) { mutate(() => { state.lineup.splice(i, 1); state.batterIndex = 0; }); }
  function show(view) { document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === view)); document.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.dataset.view === view)); }
  document.querySelectorAll('.tab').forEach(el => el.onclick = () => show(el.dataset.view));
  // MVP: import registered participants for Metamorpho without overwriting local lineup.
  const GAME_ID = '824dfde6-a03c-4846-9c19-81343592d29b';
  const TEAM_ID = '7f23214f-ea49-4b45-84a0-2fa23c24230a';
  $('loadPlayers').onclick = async () => {
    const button = $('loadPlayers');
    const status = $('loadStatus');
    button.disabled = true;
    status.textContent = 'Consultando participantes en PostgreSQL…';
    try {
      const response = await fetch(`/api/game-participants/game/${GAME_ID}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const participants = await response.json();
      if (!Array.isArray(participants)) throw new Error('Respuesta inesperada de la API');
      const names = participants
        .filter(p => p.teamId === TEAM_ID)
        .map(p => (p.playerName || p.guestName || '').trim())
        .filter(Boolean);
      const existing = new Set(state.lineup.map(n => n.toLocaleLowerCase()));
      const additions = names.filter(name => {
        const key = name.toLocaleLowerCase();
        if (existing.has(key)) return false;
        existing.add(key);
        return true;
      });
      if (additions.length) mutate(() => { state.lineup.push(...additions); });
      status.textContent = `Encontrados ${names.length} participante(s) de Metamorpho. Añadidos ${additions.length} al lineup; se conservaron los anteriores. Revisa el orden antes del partido.`;
    } catch (err) {
      status.textContent = `No se pudieron cargar los jugadores (${err.message}). Comprueba que Spring Boot esté funcionando y que abras esta página desde su servidor.`;
    } finally {
      button.disabled = false;
    }
  };
  // GitHub Pages is a static host; it cannot reach the developer's localhost API.
  if (location.hostname.endsWith('github.io')) {
    $('loadPlayers').disabled = true;
    $('loadStatus').textContent = 'Modo independiente: agrega jugadores manualmente. La base de datos Neon no está disponible en esta versión.';
  }
  $('exportData').onclick = () => {
    const blob = new Blob([JSON.stringify({ format: 'metamorpho-mvp-v1', state }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'metamorpho-respaldo.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  $('importData').onclick = () => $('importFile').click();
  $('importFile').onchange = async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (payload.format !== 'metamorpho-mvp-v1' || !payload.state || !Array.isArray(payload.state.lineup)) throw new Error('Formato inválido');
      if (!confirm('¿Reemplazar el lineup y marcador actuales con este respaldo?')) return;
      const v = payload.state;
      if (!v.lineup.every(x => typeof x === 'string') || !['batterIndex','homeScore','awayScore','outs','inning'].every(k => Number.isInteger(v[k]) && v[k] >= 0)) throw new Error('Datos inválidos');
      state = { ...fresh(), ...v }; save(); alert('Respaldo restaurado.');
    } catch (error) { alert('No se pudo importar: ' + error.message); }
    finally { event.target.value = ''; }
  };
  $('addPlayer').onclick = () => { const name = $('playerName').value.trim(); if (!name) return; mutate(() => { state.lineup.push(name); }); $('playerName').value = ''; $('playerName').focus(); };
  $('playerName').addEventListener('keydown', e => { if (e.key === 'Enter') $('addPlayer').click(); });
  $('resetLineup').onclick = () => { if (confirm('¿Borrar todo el lineup?')) mutate(() => { state.lineup = []; state.batterIndex = 0; }); };
  $('startGame').onclick = () => { if (!state.lineup.length) return alert('Agrega al menos un jugador.'); show('game'); };
  $('nextBatterBtn').onclick = () => { if (state.lineup.length) mutate(() => { state.batterIndex = (state.batterIndex + 1) % state.lineup.length; }); };
  $('addRun').onclick = () => mutate(() => { state.homeScore++; });
  $('addOut').onclick = () => mutate(() => { state.outs++; if (state.outs >= 3) { state.outs = 0; state.inning++; } });
  $('nextInning').onclick = () => mutate(() => { state.inning++; state.outs = 0; });
  $('undo').onclick = () => { if (!snapshots.length) return alert('No hay cambios para deshacer en esta sesión.'); state = JSON.parse(snapshots.pop()); save(); };
  $('resetGame').onclick = () => { if (confirm('¿Reiniciar marcador, outs y bateador? El lineup se conserva.')) mutate(() => { const lineup = state.lineup; state = { ...fresh(), lineup }; }); };
  render();
})();
