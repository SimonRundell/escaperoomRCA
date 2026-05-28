/**
 * StudentGame — main in-game view for a student.
 *
 * Polls the game state every 3 s and navigates to EscapeSuccess when
 * the player has revealed all hidden nodes.
 *
 * @license CC BY-NC-SA 4.0 — Simon Rundell / CodeMonkey Design
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGameState } from '../api/gameApi';
import ETADiagram    from '../components/ETADiagram';
import NodeQuestion  from '../components/NodeQuestion';
import Leaderboard   from '../components/Leaderboard';
import Timer         from '../components/Timer';

export default function StudentGame() {
    const { code } = useParams();
    const navigate = useNavigate();

    // Retrieve stored player identity
    const saved = (() => {
        try { return JSON.parse(localStorage.getItem('errc_player')); }
        catch { return null; }
    })();

    const [gameState, setGameState]   = useState(null);
    const [error, setError]           = useState(null);
    const [activeNodeId, setActiveNodeId] = useState(null);
    const [revealedNodes, setRevealedNodes] = useState([]);
    const [penalty, setPenalty]       = useState(0);
    const [showBoard, setShowBoard]   = useState(false);

    // Redirect to join if no stored player identity
    useEffect(() => {
        if (!saved?.playerId) navigate(`/join/${code}`);
    }, [saved, code, navigate]);

    const playerId = saved?.playerId ?? 0;

    const fetchState = useCallback(async () => {
        try {
            const data = await getGameState(code);
            setGameState(data);

            // Sync my revealed nodes from server
            const me = data.players?.find(p => p.id === playerId);
            if (me) {
                setRevealedNodes(me.revealedNodes ?? []);
                setPenalty(me.total_penalty_seconds ?? 0);

                // Redirect once escaped
                if (me.escaped_at) {
                    navigate(`/escaped/${code}`);
                }
            }
        } catch {
            setError('Connection lost — retrying…');
        }
    }, [code, playerId, navigate]);

    // Initial load + 3 s poll
    useEffect(() => {
        fetchState();
        const id = setInterval(fetchState, 3000);
        return () => clearInterval(id);
    }, [fetchState]);

    if (error && !gameState) {
        return <div className="game-error">{error}</div>;
    }
    if (!gameState) {
        return <div className="game-loading">Loading…</div>;
    }

    const { game, scenario, leaderboard } = gameState;

    // Game hasn't started yet — waiting room
    if (game.status === 'waiting') {
        return (
            <div className="game-waiting">
                <div className="game-waiting__card">
                    <div className="game-waiting__icon">⏳</div>
                    <h2>Waiting for teacher to start…</h2>
                    <p className="game-waiting__code">Game code: <strong>{code}</strong></p>
                    <p>Players joined: <strong>{gameState.players?.length ?? 0}</strong></p>
                    <div className="game-waiting__players">
                        {gameState.players?.map(p => (
                            <span key={p.id} className="game-waiting__player-chip">
                                {p.name}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (game.status === 'paused') {
        return (
            <div className="game-paused">
                <div className="game-paused__overlay">
                    <div className="game-paused__icon">⏸</div>
                    <h2>Game Paused</h2>
                    <p>Your teacher has paused the game. Stand by…</p>
                </div>
            </div>
        );
    }

    if (game.status === 'ended') {
        navigate(`/escaped/${code}`);
        return null;
    }

    const hiddenTotal = scenario?.hiddenNodeIds?.length ?? 0;

    // Active question node data (questions have correct answers stripped server-side)
    const activeQuestion = activeNodeId
        ? scenario?.questions?.[activeNodeId]
        : null;
    const activeNodeObj = activeNodeId
        ? [...(scenario?.branches ?? []), ...(scenario?.outcomes ?? [])]
              .find(n => n.id === activeNodeId)
        : null;

    const handleAnswered = (result) => {
        if (result.correct) {
            setRevealedNodes(prev => [...new Set([...prev, activeNodeId])]);
        } else {
            setPenalty(p => p + (result.penalty ?? 0));
        }
        fetchState(); // Refresh leaderboard immediately
    };

    const handleHintUsed = (result) => {
        setPenalty(p => p + (result.penalty ?? 0));
    };

    return (
        <div className="game-page">
            {/* Header bar */}
            <header className="game-header">
                <div className="game-header__title">
                    <span className="game-header__icon">🔐</span>
                    <span>{scenario?.title ?? 'Fault Tree Escape Room'}</span>
                </div>
                <div className="game-header__meta">
                    <span className="game-header__progress">
                        {revealedNodes.length}/{hiddenTotal} nodes revealed
                    </span>
                    <Timer
                        startedAt={game.startedAt}
                        penalty={penalty}
                        stopped={game.status !== 'active'}
                    />
                </div>
                <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => setShowBoard(b => !b)}
                >
                    {showBoard ? 'Hide Board' : '🏆 Leaderboard'}
                </button>
            </header>

            {/* Scenario context */}
            <section className="game-context">
                <p>{scenario?.context}</p>
                <p className="game-context__event">
                    <strong>Initiating event:</strong> {scenario?.initiatingEvent}
                </p>
            </section>

            {/* ETA diagram */}
            <section className="game-diagram">
                <ETADiagram
                    scenario={scenario}
                    revealedNodes={revealedNodes}
                    onNodeClick={(nodeId) => setActiveNodeId(nodeId)}
                    disabled={game.status !== 'active'}
                />
            </section>

            {/* Slide-in leaderboard panel */}
            {showBoard && (
                <aside className="game-board-panel">
                    <h3>Leaderboard</h3>
                    <Leaderboard entries={leaderboard} myPlayerId={playerId} />
                </aside>
            )}

            {/* Question modal */}
            {activeNodeId && activeQuestion && (
                <NodeQuestion
                    key={activeNodeId}
                    questionData={activeQuestion}
                    nodeLabel={activeNodeObj?.label ?? activeNodeId}
                    playerId={playerId}
                    nodeId={activeNodeId}
                    onClose={() => setActiveNodeId(null)}
                    onAnswered={(result) => {
                        handleAnswered(result);
                        if (result.correct) {
                            // Keep modal open to show explanation, then close
                            setTimeout(() => setActiveNodeId(null), 2500);
                        }
                    }}
                    onHintUsed={handleHintUsed}
                    hintsLeft={2}
                    hintPenalty={30}
                    wrongPenalty={10}
                />
            )}
        </div>
    );
}
