/**
 * Leaderboard — live ranking table shown in both student and teacher views.
 *
 * @param {Array}   entries     — Leaderboard rows from the API
 * @param {number}  myPlayerId  — Highlight this player's row (0 for teacher view)
 *
 * @license CC BY-NC-SA 4.0 — Simon Rundell / CodeMonkey Design
 */

/**
 * Converts a total seconds value to M:SS string.
 * @param {number|null} secs
 * @returns {string}
 */
const fmtTime = (secs) => {
    if (secs == null) return '—';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
};

export default function Leaderboard({ entries = [], myPlayerId = 0 }) {
    if (!entries.length) {
        return <p className="leaderboard__empty">No players yet.</p>;
    }

    return (
        <div className="leaderboard">
            <table className="leaderboard__table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>Progress</th>
                        <th>Status</th>
                        <th>Time</th>
                    </tr>
                </thead>
                <tbody>
                    {entries.map((e) => (
                        <tr
                            key={e.playerId}
                            className={[
                                e.escaped   ? 'leaderboard__row--escaped'    : '',
                                e.playerId === myPlayerId ? 'leaderboard__row--me' : '',
                            ].join(' ').trim()}
                        >
                            <td className="leaderboard__rank">{e.rank}</td>
                            <td className="leaderboard__name">
                                {e.name}
                                {e.playerId === myPlayerId && <span className="leaderboard__you"> (you)</span>}
                            </td>
                            <td className="leaderboard__progress">
                                <NodeDots revealed={e.nodesRevealed} total={e.totalNodes} />
                            </td>
                            <td className="leaderboard__status">
                                {e.escaped ? '🔓 Escaped!' : `${e.nodesRevealed}/${e.totalNodes}`}
                            </td>
                            <td className="leaderboard__time">
                                {e.escaped ? fmtTime(e.escapeSeconds) : '—'}
                                {e.penaltySeconds > 0 && (
                                    <span className="leaderboard__penalty">
                                        {` +${fmtTime(e.penaltySeconds)}`}
                                    </span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/**
 * Small dot indicators showing node reveal progress.
 * @param {number} revealed
 * @param {number} total
 */
function NodeDots({ revealed, total }) {
    return (
        <span className="node-dots">
            {Array.from({ length: total }, (_, i) => (
                <span
                    key={i}
                    className={`node-dot${i < revealed ? ' node-dot--revealed' : ''}`}
                    title={i < revealed ? 'Revealed' : 'Hidden'}
                />
            ))}
        </span>
    );
}
