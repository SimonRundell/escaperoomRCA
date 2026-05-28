/**
 * JoinGame — landing page where students enter a game code and their name.
 * Pre-fills the code when a ?code=XXXX param is present in the URL.
 *
 * @license CC BY-NC-SA 4.0 — Simon Rundell / CodeMonkey Design
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { joinGame } from '../api/gameApi';

export default function JoinGame() {
    const { code: paramCode } = useParams();
    const navigate = useNavigate();

    const [code, setCode]   = useState(paramCode?.toUpperCase() ?? '');
    const [name, setName]   = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Auto-populate from localStorage if previously joined
    useEffect(() => {
        const saved = localStorage.getItem('errc_player');
        if (saved) {
            try {
                const { gameCode, playerName } = JSON.parse(saved);
                if (gameCode && playerName) {
                    setCode(gameCode);
                    setName(playerName);
                }
            } catch { /* ignore */ }
        }
    }, []);

    const handleJoin = async (e) => {
        e.preventDefault();
        if (!code.trim() || !name.trim()) {
            setError('Please enter both a game code and your name.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await joinGame(code.trim().toUpperCase(), name.trim());
            if (res.success) {
                localStorage.setItem('errc_player', JSON.stringify({
                    gameCode:  res.gameCode,
                    playerId:  res.playerId,
                    playerName: res.name,
                }));
                navigate(`/game/${res.gameCode}`);
            } else {
                setError(res.error ?? 'Could not join game.');
            }
        } catch (err) {
            setError(err.response?.data?.error ?? 'Network error — check the game code and try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="join-page">
            <div className="join-card">
                <div className="join-card__logo">
                    <span className="join-card__icon">🔐</span>
                    <h1>Fault Tree<br />Escape Room</h1>
                    <p className="join-card__subtitle">Event Tree Analysis — can you unlock all the nodes?</p>
                </div>

                <form onSubmit={handleJoin} className="join-form">
                    <label className="form-label" htmlFor="code">Game Code</label>
                    <input
                        id="code"
                        className="form-input form-input--code"
                        type="text"
                        placeholder="e.g. AB3K7X"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        maxLength={6}
                        autoFocus
                        required
                    />

                    <label className="form-label" htmlFor="name">Your Name</label>
                    <input
                        id="name"
                        className="form-input"
                        type="text"
                        placeholder="Enter your first name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={40}
                        required
                    />

                    {error && <p className="form-error">{error}</p>}

                    <button className="btn btn--primary btn--full" type="submit" disabled={loading}>
                        {loading ? 'Joining…' : 'Join Game →'}
                    </button>
                </form>

                <p className="join-card__teacher-link">
                    Teacher? <a href="/teacher">Go to dashboard →</a>
                </p>
            </div>
        </div>
    );
}
