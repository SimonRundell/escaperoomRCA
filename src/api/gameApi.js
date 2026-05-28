/**
 * Axios wrappers for the Fault Tree Escape Room PHP API.
 * All requests go through the Vite dev-server proxy (/api → PHP).
 *
 * withCredentials is enabled globally so PHP session cookies are sent on
 * every request — required for teacher authentication.
 *
 * @license CC BY-NC-SA 4.0 — Simon Rundell / CodeMonkey Design
 */
import axios from 'axios';

axios.defaults.withCredentials = true;

const BASE = '/api';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** Sends login credentials. Starts a PHP session on success. */
export const loginTeacher = (username, password) =>
    axios.post(`${BASE}/auth.php?action=login`, { username, password }).then(r => r.data);

/** Destroys the current PHP session. */
export const logoutTeacher = () =>
    axios.post(`${BASE}/auth.php?action=logout`).then(r => r.data);

/** Returns { loggedIn: bool, username }. Used by ProtectedTeacher on mount. */
export const checkAuth = () =>
    axios.get(`${BASE}/auth.php?action=check`).then(r => r.data);

/** Creates the first teacher account. Blocked by the API once any teacher exists. */
export const setupTeacher = (username, password) =>
    axios.post(`${BASE}/auth.php?action=setup`, { username, password }).then(r => r.data);

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

/** Creates a new game via Gemini. Returns { code, scenario }. */
export const createGame = () =>
    axios.post(`${BASE}/game.php?action=create`).then(r => r.data);

/** Student game state (no correct answers). */
export const getGameState = (code) =>
    axios.get(`${BASE}/game.php?action=state&code=${code}`).then(r => r.data);

/** Teacher game state (includes correct answers + explanations). */
export const getTeacherState = (code) =>
    axios.get(`${BASE}/game.php?action=teacher_state&code=${code}`).then(r => r.data);

/** Updates game status: 'active' | 'paused' | 'ended'. */
export const updateGameStatus = (code, status) =>
    axios.post(`${BASE}/game.php?action=update_status`, { code, status }).then(r => r.data);

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

/** Joins a game. Returns { playerId, name, gameCode, rejoin }. */
export const joinGame = (code, name) =>
    axios.post(`${BASE}/player.php?action=join`, { code, name }).then(r => r.data);

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/** Submits an answer for a hidden node. Returns { correct, explanation, penalty }. */
export const submitAnswer = (playerId, nodeId, optionIndex) =>
    axios.post(`${BASE}/progress.php?action=answer`, { playerId, nodeId, optionIndex })
         .then(r => r.data);

/** Requests a hint. Returns { hint, penalty, hintsUsed, hintsLeft }. */
export const requestHint = (playerId, nodeId) =>
    axios.post(`${BASE}/progress.php?action=hint`, { playerId, nodeId }).then(r => r.data);

/** Returns the live leaderboard for a game code. */
export const getLeaderboard = (code) =>
    axios.get(`${BASE}/progress.php?action=leaderboard&code=${code}`).then(r => r.data);
