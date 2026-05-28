/**
 * TeacherDashboard — game control panel for the teacher.
 *
 * Features:
 *  - Generate new game (Gemini call)
 *  - Show game code and student join URL
 *  - Player list with live progress dots
 *  - Start / Pause / Resume / End controls
 *  - Live leaderboard
 *  - ETA preview (teacher view — all labels visible)
 *
 * @license CC BY-NC-SA 4.0 — Simon Rundell / CodeMonkey Design
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createGame, getTeacherState, updateGameStatus } from '../api/gameApi';
import ETADiagram  from '../components/ETADiagram';
import PlayerList  from '../components/PlayerList';
import Leaderboard from '../components/Leaderboard';
import Timer       from '../components/Timer';

export default function TeacherDashboard() {
    const { code: paramCode } = useParams();
    const navigate = useNavigate();

    const [gameCode, setGameCode]   = useState(paramCode ?? '');
    const [gameState, setGameState] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [error, setError]         = useState(null);
    const [activeTab, setActiveTab] = useState('players'); // players | diagram | board

    // Reload on param change
    useEffect(() => { if (paramCode) setGameCode(paramCode); }, [paramCode]);

    const fetchState = useCallback(async () => {
        if (!gameCode) return;
        try {
            const data = await getTeacherState(gameCode);
            setGameState(data);
            setError(null);
        } catch {
            setError('Could not load game — check the code.');
        }
    }, [gameCode]);

    useEffect(() => {
        fetchState();
        if (!gameCode) return;
        const id = setInterval(fetchState, 3000);
        return () => clearInterval(id);
    }, [fetchState, gameCode]);

    const handleGenerate = async () => {
        setGenerating(true);
        setError(null);
        setGameState(null);
        try {
            const res = await createGame();
            if (res.success) {
                setGameCode(res.code);
                navigate(`/teacher/${res.code}`);
            } else {
                setError(res.error ?? 'Generation failed');
            }
        } catch (err) {
            setError(err.response?.data?.error ?? 'Gemini call failed — check API key in .config.json');
        } finally {
            setGenerating(false);
        }
    };

    const handleStatus = async (status) => {
        if (!gameCode) return;
        try {
            await updateGameStatus(gameCode, status);
            fetchState();
        } catch {
            setError('Status update failed.');
        }
    };

    const status = gameState?.game?.status;
    const scenario = gameState?.scenario;
    const players  = gameState?.players  ?? [];
    const board    = gameState?.leaderboard ?? [];

    return (
        <div className="teacher-page">
            {/* ── Sidebar ────────────────────────────────────────────────── */}
            <aside className="teacher-sidebar">
                <div className="teacher-sidebar__logo">
                    <span className="teacher-sidebar__icon">🔐</span>
                    <span>Escape Room</span>
                    <span className="teacher-sidebar__role">Teacher</span>
                </div>

                <button
                    className="btn btn--primary btn--full teacher-sidebar__generate"
                    onClick={handleGenerate}
                    disabled={generating}
                >
                    {generating ? (
                        <><span className="spinner" /> Generating…</>
                    ) : (
                        '⚡ New Game (Gemini)'
                    )}
                </button>

                {error && <p className="teacher-sidebar__error">{error}</p>}

                {gameCode && (
                    <div className="game-code-panel">
                        <p className="game-code-panel__label">Game Code</p>
                        <p className="game-code-panel__code">{gameCode}</p>
                        <p className="game-code-panel__url">
                            {window.location.origin}/join/{gameCode}
                        </p>
                        <button
                            className="btn btn--ghost btn--sm"
                            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join/${gameCode}`)}
                        >
                            Copy link
                        </button>
                    </div>
                )}

                {/* Controls */}
                {status && (
                    <div className="teacher-controls">
                        <p className="teacher-controls__label">Controls</p>
                        {status === 'waiting' && (
                            <button className="btn btn--success btn--full" onClick={() => handleStatus('active')}>
                                ▶ Start Game
                            </button>
                        )}
                        {status === 'active' && (
                            <button className="btn btn--warning btn--full" onClick={() => handleStatus('paused')}>
                                ⏸ Pause
                            </button>
                        )}
                        {status === 'paused' && (
                            <button className="btn btn--success btn--full" onClick={() => handleStatus('active')}>
                                ▶ Resume
                            </button>
                        )}
                        {(status === 'active' || status === 'paused') && (
                            <button className="btn btn--danger btn--full" onClick={() => handleStatus('ended')}>
                                ■ End Game
                            </button>
                        )}
                        <div className={`status-badge status-badge--${status}`}>
                            {status.toUpperCase()}
                        </div>
                        {status === 'active' && (
                            <Timer startedAt={gameState?.game?.startedAt} />
                        )}
                    </div>
                )}

                {/* Players count */}
                {players.length > 0 && (
                    <p className="teacher-sidebar__players-count">
                        {players.length} student{players.length > 1 ? 's' : ''} joined
                        {' · '}{players.filter(p => p.escaped_at).length} escaped
                    </p>
                )}
            </aside>

            {/* ── Main panel ─────────────────────────────────────────────── */}
            <main className="teacher-main">
                {!gameCode && !generating && (
                    <div className="teacher-empty">
                        <p className="teacher-empty__icon">⚡</p>
                        <h2>Ready to generate</h2>
                        <p>Click <strong>New Game (Gemini)</strong> to generate a fresh ETA scenario and start a session.</p>
                    </div>
                )}

                {generating && (
                    <div className="teacher-empty">
                        <p className="teacher-empty__icon">🤖</p>
                        <h2>Gemini is building your scenario…</h2>
                        <p>Generating ETA tree, questions, and node labels. Usually takes 5–15 seconds.</p>
                    </div>
                )}

                {gameState && scenario && (
                    <>
                        {/* Scenario summary */}
                        <div className="teacher-scenario-header">
                            <h2>{scenario.title}</h2>
                            <p>{scenario.context}</p>
                            <p className="teacher-scenario-header__event">
                                <strong>Initiating event:</strong> {scenario.initiatingEvent}
                            </p>
                        </div>

                        {/* Tabs */}
                        <div className="teacher-tabs">
                            {['players', 'diagram', 'board'].map(tab => (
                                <button
                                    key={tab}
                                    className={`teacher-tab${activeTab === tab ? ' teacher-tab--active' : ''}`}
                                    onClick={() => setActiveTab(tab)}
                                >
                                    {tab === 'players' && `👥 Students (${players.length})`}
                                    {tab === 'diagram' && '🌳 ETA Diagram'}
                                    {tab === 'board'   && '🏆 Leaderboard'}
                                </button>
                            ))}
                        </div>

                        <div className="teacher-tab-content">
                            {activeTab === 'players' && (
                                <PlayerList
                                    players={players}
                                    hiddenNodeIds={scenario.hiddenNodeIds}
                                />
                            )}

                            {activeTab === 'diagram' && (
                                <ETADiagram
                                    scenario={scenario}
                                    revealedNodes={[]}
                                    teacherView={true}
                                    disabled={true}
                                />
                            )}

                            {activeTab === 'board' && (
                                <Leaderboard entries={board} myPlayerId={0} />
                            )}
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
