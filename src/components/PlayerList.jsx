/**
 * PlayerList — teacher dashboard widget showing all joined players and their status.
 *
 * @param {Array}  players      — Player objects from game state
 * @param {Array}  hiddenNodeIds — IDs of the hidden nodes (for progress context)
 *
 * @license CC BY-NC-SA 4.0 — Simon Rundell / CodeMonkey Design
 */
export default function PlayerList({ players = [], hiddenNodeIds = [] }) {
    if (!players.length) {
        return <p className="player-list__empty">Waiting for students to join…</p>;
    }

    return (
        <ul className="player-list">
            {players.map((p) => {
                const revealed = p.revealedNodes?.length ?? 0;
                const total    = hiddenNodeIds.length;
                return (
                    <li key={p.id} className={`player-list__item${p.escaped_at ? ' player-list__item--escaped' : ''}`}>
                        <span className="player-list__name">{p.name}</span>
                        <span className="player-list__progress">
                            {Array.from({ length: total }, (_, i) => (
                                <span
                                    key={i}
                                    className={`node-dot${i < revealed ? ' node-dot--revealed' : ''}`}
                                />
                            ))}
                        </span>
                        <span className="player-list__badge">
                            {p.escaped_at ? '🔓 Escaped' : `${revealed}/${total}`}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
