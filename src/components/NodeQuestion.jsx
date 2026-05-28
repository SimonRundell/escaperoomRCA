/**
 * NodeQuestion — modal overlay presented when a student clicks a hidden "???" node.
 * Shows the question, 4 MCQ options, a hint button and a close button.
 *
 * @param {object}   questionData   — { question, options } — NO correctIndex (stripped server-side)
 * @param {string}   nodeLabel      — Revealed label shown after a correct answer
 * @param {number}   playerId
 * @param {string}   nodeId
 * @param {Function} onClose        — Dismiss without answering
 * @param {Function} onAnswered     — Called with { correct, explanation, penalty } after submission
 * @param {Function} onHintUsed     — Called with hint response data
 * @param {number}   hintsLeft      — Remaining hints for this node
 * @param {number}   hintPenalty    — Seconds added per hint (display only)
 * @param {number}   wrongPenalty   — Seconds added per wrong answer (display only)
 *
 * @license CC BY-NC-SA 4.0 — Simon Rundell / CodeMonkey Design
 */
import { useState } from 'react';
import { submitAnswer, requestHint } from '../api/gameApi';

export default function NodeQuestion({
    questionData,
    nodeLabel,
    playerId,
    nodeId,
    onClose,
    onAnswered,
    onHintUsed,
    hintsLeft = 2,
    hintPenalty = 30,
    wrongPenalty = 10,
}) {
    const [selected, setSelected]       = useState(null);
    const [result, setResult]           = useState(null);   // { correct, explanation, penalty }
    const [hintText, setHintText]       = useState(null);
    const [hintsRemaining, setHintsRemaining] = useState(hintsLeft);
    const [loading, setLoading]         = useState(false);
    const [error, setError]             = useState(null);

    const handleSubmit = async () => {
        if (selected === null || loading) return;
        setLoading(true);
        setError(null);
        try {
            const res = await submitAnswer(playerId, nodeId, selected);
            setResult(res);
            onAnswered(res);
        } catch {
            setError('Could not submit — check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const handleHint = async () => {
        if (hintsRemaining <= 0 || loading) return;
        setLoading(true);
        try {
            const res = await requestHint(playerId, nodeId);
            if (res.hint) {
                setHintText(res.hint);
                setHintsRemaining(res.hintsLeft);
                onHintUsed(res);
            } else {
                setError(res.error ?? 'No hints available');
            }
        } catch {
            setError('Could not fetch hint.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={result?.correct ? undefined : onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                {/* Correct answer state */}
                {result?.correct ? (
                    <div className="modal__success">
                        <div className="modal__success-icon">🔓</div>
                        <h2>Node Revealed!</h2>
                        <p className="modal__node-label">{nodeLabel}</p>
                        {result.explanation && (
                            <p className="modal__explanation">{result.explanation}</p>
                        )}
                        <button className="btn btn--primary" onClick={onClose}>
                            Continue
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="modal__header">
                            <h2 className="modal__title">Hidden Node: ???</h2>
                            <button className="modal__close" onClick={onClose} aria-label="Close">×</button>
                        </div>

                        <p className="modal__question">{questionData?.question}</p>

                        {hintText && (
                            <div className="modal__hint">
                                <span className="modal__hint-label">Hint:</span> {hintText}
                            </div>
                        )}

                        {result && !result.correct && (
                            <div className="modal__wrong">
                                ✗ Incorrect — {wrongPenalty}s penalty added. Try again.
                            </div>
                        )}

                        {error && <div className="modal__error">{error}</div>}

                        <div className="modal__options">
                            {questionData?.options?.map((opt, i) => (
                                <button
                                    key={i}
                                    className={`option-btn${selected === i ? ' option-btn--selected' : ''}`}
                                    onClick={() => setSelected(i)}
                                    disabled={loading}
                                >
                                    <span className="option-btn__letter">{String.fromCharCode(65 + i)}</span>
                                    {opt}
                                </button>
                            ))}
                        </div>

                        <div className="modal__actions">
                            <button
                                className="btn btn--hint"
                                onClick={handleHint}
                                disabled={hintsRemaining <= 0 || loading}
                                title={hintsRemaining <= 0 ? 'No hints left' : `−${hintPenalty}s per hint`}
                            >
                                💡 Hint ({hintsRemaining} left, −{hintPenalty}s)
                            </button>
                            <button
                                className="btn btn--primary"
                                onClick={handleSubmit}
                                disabled={selected === null || loading}
                            >
                                {loading ? 'Checking…' : 'Submit Answer'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
