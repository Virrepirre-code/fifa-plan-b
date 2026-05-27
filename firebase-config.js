/* ----------------------------------------------------------------
 * Plan B FIFA Cup — Firebase-konfiguration
 *
 * Klistra in din Firebase Realtime DB-config här för att aktivera
 * live-sync mellan alla enheter. Lämna tomt så funkar sajten som
 * vanligt (lokal-bara, localStorage).
 *
 * Så här gör du:
 * 1. Gå till https://console.firebase.google.com/
 * 2. "Add project" → namnge t.ex. "plan-b-fifa-cup" → skapa
 * 3. I projektet: klicka webb-ikonen </> → registrera app → kopiera
 *    config-objektet du får och klistra in nedan
 * 4. I vänstermenyn: "Realtime Database" → "Create database" →
 *    välj region → välj "Start in test mode" (öppet i 30 dgr)
 * 5. Spara filen, pusha till repot, vänta på deployen
 * ---------------------------------------------------------------- */

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBkYvkajM33-reGv0LiLpUw6x5VAwn6d88",
  authDomain: "fifatest-3f3e9.firebaseapp.com",
  // LÄGG IN DIN DATABASE-URL HÄR efter att du skapat Realtime Database
  // T.ex. "https://fifatest-3f3e9-default-rtdb.europe-west1.firebasedatabase.app"
  // Utan denna rad körs sajten i lokal-läge (ingen sync).
  // databaseURL: "",
  projectId: "fifatest-3f3e9",
  storageBucket: "fifatest-3f3e9.firebasestorage.app",
  messagingSenderId: "903453877653",
  appId: "1:903453877653:web:a13e06598cfc83bafb829c",
};

// Turnerings-ID: alla som öppnar samma URL med samma #hash delar samma turnering.
// Default = "default". Vill du köra parallella turneringar, sätt t.ex.
// https://...github.io/fifa-plan-b/#kickoff-2026
window.TOURNAMENT_ID = (location.hash || '#default').slice(1) || 'default';

// Stub så att app.js alltid kan kalla PlanBSync, även om sync.js inte
// hinner ladda eller faller på nätverket. sync.js skriver över denna.
window.PlanBSync = window.PlanBSync || {
  status: 'off',
  _onRemoteCallbacks: [],
  push: () => {},
  onRemote(cb) { this._onRemoteCallbacks.push(cb); },
};
