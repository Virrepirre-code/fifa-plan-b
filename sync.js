/* ----------------------------------------------------------------
 * Plan B FIFA Cup — Firebase Realtime DB sync layer
 *
 * Exponerar en enkel API på window.PlanBSync:
 *   - init()                — initierar Firebase om config finns
 *   - push(state)           — skriver state till DB (debounced)
 *   - onRemote(callback)    — kallar callback(state) när remote ändras
 *   - status                — 'off' | 'connecting' | 'live' | 'error'
 *
 * App.js använder sync om window.PlanBSync.status === 'live',
 * annars kör den lokal-bara via localStorage.
 * ---------------------------------------------------------------- */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase, ref, set, onValue, onDisconnect, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const config = window.FIREBASE_CONFIG;
const tournamentId = window.TOURNAMENT_ID || 'default';

// Återanvänd stub-objektet om det finns (definierat i firebase-config.js)
// så att eventuella tidigare registrerade onRemote-callbacks bevaras.
const sync = window.PlanBSync || {};
sync.status = sync.status || 'off';
sync.enabled = false;
sync._onRemoteCallbacks = sync._onRemoteCallbacks || [];
sync._pushTimer = null;
sync._lastPushed = null;
sync._suppressNext = false;
sync.onRemote = function (cb) { this._onRemoteCallbacks.push(cb); };
sync._setStatus = function (s, detail) {
  this.status = s;
  window.dispatchEvent(new CustomEvent('planb:sync-status', { detail: { status: s, info: detail } }));
};

window.PlanBSync = sync;

if (!config || !config.databaseURL) {
  sync._setStatus('off', 'Ingen Firebase-config — kör lokalt.');
} else {
  try {
    sync._setStatus('connecting');
    const app = initializeApp(config);
    const db = getDatabase(app);
    const stateRef = ref(db, `tournaments/${tournamentId}/state`);
    const presenceRef = ref(db, `tournaments/${tournamentId}/presence/${Math.random().toString(36).slice(2, 10)}`);

    // Lyssna på remote ändringar
    onValue(stateRef, (snap) => {
      const val = snap.val();
      if (val == null) return;
      if (sync._suppressNext) {
        sync._suppressNext = false;
        return;
      }
      sync._onRemoteCallbacks.forEach(cb => {
        try { cb(val); } catch (e) { console.error('Sync callback error:', e); }
      });
    }, (err) => {
      console.error('Firebase listen error:', err);
      sync._setStatus('error', err.message);
    });

    // Sätt presence (närvaro)
    set(presenceRef, { online: true, ts: serverTimestamp() });
    onDisconnect(presenceRef).remove();

    sync.enabled = true;
    sync._setStatus('live', `turnering: ${tournamentId}`);

    sync.push = function (state) {
      if (!sync.enabled) return;
      clearTimeout(sync._pushTimer);
      sync._pushTimer = setTimeout(async () => {
        try {
          const payload = JSON.stringify(state);
          if (payload === sync._lastPushed) return;
          sync._lastPushed = payload;
          sync._suppressNext = true;
          await set(stateRef, state);
        } catch (e) {
          console.error('Sync push error:', e);
          sync._setStatus('error', e.message);
        }
      }, 250);
    };
  } catch (e) {
    console.error('Firebase init error:', e);
    sync._setStatus('error', e.message);
  }
}

// Default no-op push så app.js alltid kan kalla det
if (!sync.push) sync.push = () => {};
