/**
 * Timer — displays elapsed seconds as MM:SS, counts up from a start timestamp.
 * Turns red when penalties are added (brief flash).
 *
 * @param {string|null} startedAt  — ISO timestamp when the game became active
 * @param {number}      penalty    — Total accumulated penalty seconds (for display)
 * @param {boolean}     stopped    — If true the timer freezes
 *
 * @license CC BY-NC-SA 4.0 — Simon Rundell / CodeMonkey Design
 */
import { useState, useEffect, useRef } from 'react';

/**
 * Formats a duration in seconds as M:SS.
 * @param {number} secs
 * @returns {string}
 */
const fmt = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
};

export default function Timer({ startedAt, penalty = 0, stopped = false }) {
    const [elapsed, setElapsed] = useState(0);
    const [flash, setFlash]     = useState(false);
    const prevPenalty = useRef(penalty);

    // Count up every second
    useEffect(() => {
        if (!startedAt || stopped) return;
        const tick = () => {
            const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
            setElapsed(Math.max(0, secs));
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [startedAt, stopped]);

    // Flash red when penalty changes
    useEffect(() => {
        if (penalty > prevPenalty.current) {
            setFlash(true);
            const id = setTimeout(() => setFlash(false), 800);
            prevPenalty.current = penalty;
            return () => clearTimeout(id);
        }
        prevPenalty.current = penalty;
    }, [penalty]);

    return (
        <div className={`timer${flash ? ' timer--penalty' : ''}`}>
            <span className="timer__value">{fmt(elapsed)}</span>
            {penalty > 0 && (
                <span className="timer__penalty">+{fmt(penalty)} penalty</span>
            )}
        </div>
    );
}
