/**
 * EscapeSuccess — celebration screen shown when a player reveals all nodes.
 *
 * @license CC BY-NC-SA 4.0 — Simon Rundell / CodeMonkey Design
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLeaderboard } from '../api/gameApi';
import Leaderboard from '../components/Leaderboard';

/** Formats seconds as M:SS. */
const fmtTime = (s) => s == null ? '—' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function EscapeSuccess() {
    const { code } = useParams();
    const navigate = useNavigate();
    const [board, setBoard]   = useState([]);
    const [myEntry, setMyEntry] = useState(null);

    const saved = (() => {
        try { return JSON.parse(localStorage.getItem('errc_player')); }
        catch { return null; }
    })();
    const playerId = saved?.playerId ?? 0;

    useEffect(() => {
        const fetchBoard = async () => {
            try {
                const res = await getLeaderboard(code);
                setBoard(res.leaderboard ?? []);
                setMyEntry(res.leaderboard?.find(e => e.playerId === playerId) ?? null);
            } catch { /* non-critical */ }
        };
        fetchBoard();
        const id = setInterval(fetchBoard, 5000);
        return () => clearInterval(id);
    }, [code, playerId]);

    return (
        <div className="escape-page">
            <div className="escape-card">
                <div className="escape-card__hero">
                    <div className="escape-card__icon">🔓</div>
                    <h1>Escaped!</h1>
                    {myEntry && (
                        <p className="escape-card__time">
                            Your time: <strong>{fmtTime(myEntry.escapeSeconds)}</strong>
                            {myEntry.penaltySeconds > 0 && (
                                <span className="escape-card__penalty">
                                    {` (incl. +${fmtTime(myEntry.penaltySeconds)} penalty)`}
                                </span>
                            )}
                        </p>
                    )}
                    {myEntry?.rank === 1 && <p className="escape-card__winner">🏆 Fastest escape!</p>}
                </div>

                <h2 className="escape-card__board-title">Live Leaderboard</h2>
                <Leaderboard entries={board} myPlayerId={playerId} />

                <button
                    className="btn btn--secondary escape-card__rejoin"
                    onClick={() => navigate(`/join/${code}`)}
                >
                    ← Back to lobby
                </button>
            </div>
        </div>
    );
}
