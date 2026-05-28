/**
 * ETADiagram — SVG-based interactive Event Tree Analysis diagram.
 *
 * Layout: fixed chain structure (always 3 branches in sequence).
 *   [Root] → [B1] → [B2] → [B3] → [Success]
 *              ↓      ↓      ↓
 *             [E1]  [E2]   [E3]
 *
 * Hidden nodes display "???" with a dashed border and cursor:pointer.
 * Clicking a hidden unrevealed node fires onNodeClick(nodeId).
 *
 * @param {object}   scenario       — Full ETA scenario from Gemini
 * @param {Array}    revealedNodes  — Node IDs the player has unlocked
 * @param {Function} onNodeClick    — Called with nodeId when a hidden node is clicked
 * @param {boolean}  teacherView    — Show all labels regardless of hidden state
 * @param {boolean}  disabled       — Prevent clicks (game paused / not started)
 *
 * @license CC BY-NC-SA 4.0 — Simon Rundell / CodeMonkey Design
 */
import { useMemo } from 'react';

/** Fixed pixel layout for a 3-branch ETA chain. */
const L = {
    svgW: 1100, svgH: 630,
    nodeW: 170, nodeH: 55, nodeRx: 8,
    spineY: 120,
    rootX: 20,
    branchX: [260, 500, 740],
    successCx: 1010, successCy: 120, successR: 48,
    // Failure circles below each branch
    failPos: [
        { cx: 345, cy: 305, r: 42 },
        { cx: 585, cy: 430, r: 42 },
        { cx: 825, cy: 548, r: 42 },
    ],
};

// Derived constants
const bTop    = L.spineY - L.nodeH / 2;
const bBottom = L.spineY + L.nodeH / 2;
const bCx     = L.branchX.map(x => x + L.nodeW / 2);

export default function ETADiagram({
    scenario,
    revealedNodes = [],
    onNodeClick,
    teacherView = false,
    disabled = false,
}) {
    const revealedSet = useMemo(() => new Set(revealedNodes), [revealedNodes]);

    if (!scenario) return null;

    const { branches = [], outcomes = [], hiddenNodeIds = [], initiatingEvent } = scenario;

    const successOutcome = outcomes.find(o => o.type === 'success');
    const failOutcomes   = branches.map(b => outcomes.find(o => o.id === b.noOutcomeId));

    /** True when the node should show as a clickable mystery. */
    const isMysterious = (id) =>
        hiddenNodeIds.includes(id) && !revealedSet.has(id) && !teacherView;

    /** Click guard — only fires for unresolved hidden nodes when game is active. */
    const clickProps = (id) =>
        !disabled && isMysterious(id)
            ? { onClick: () => onNodeClick(id), className: 'eta-node-clickable' }
            : {};

    /**
     * Chooses fill / stroke based on node type and mystery state.
     * @param {'branch'|'success'|'failure'} type
     * @param {string} id
     */
    const fillOf = (type, id) => {
        if (isMysterious(id)) return { fill: '#555', stroke: '#333', dash: '6 3' };
        if (hiddenNodeIds.includes(id) && revealedSet.has(id)) {
            // Freshly revealed — use a brighter variant to signal success
            const base = type === 'success' ? '#43a047' : type === 'failure' ? '#e53935' : '#3d7ec2';
            return { fill: base, stroke: base, dash: 'none' };
        }
        if (type === 'success') return { fill: '#2e7d32', stroke: '#1b5e20', dash: 'none' };
        if (type === 'failure') return { fill: '#b71c1c', stroke: '#7f0000', dash: 'none' };
        return { fill: '#2d5a8e', stroke: '#1a3a5c', dash: 'none' };
    };

    /**
     * ForeignObject text box centred inside a bounding rect.
     * @param {number} x @param {number} y @param {number} w @param {number} h
     * @param {string} text @param {boolean} mystery
     */
    const NodeText = ({ x, y, w, h, text, mystery }) => (
        <foreignObject x={x + 3} y={y + 3} width={w - 6} height={h - 6}>
            <div
                xmlns="http://www.w3.org/1999/xhtml"
                className={`eta-node-text${mystery ? ' eta-node-text--hidden' : ''}`}
            >
                {text}
            </div>
        </foreignObject>
    );

    return (
        <div className="eta-diagram-wrapper">
            <svg
                viewBox={`0 0 ${L.svgW} ${L.svgH}`}
                width="100%"
                className="eta-diagram"
                role="img"
                aria-label="Event Tree Analysis diagram"
            >
                {/* ── YES spine lines ─────────────────────────────────────── */}
                {/* Root → B1 */}
                <line x1={L.rootX + L.nodeW} y1={L.spineY} x2={L.branchX[0]} y2={L.spineY} className="eta-line-yes" />
                {/* B1 → B2 */}
                <line x1={L.branchX[0] + L.nodeW} y1={L.spineY} x2={L.branchX[1]} y2={L.spineY} className="eta-line-yes" />
                {/* B2 → B3 */}
                <line x1={L.branchX[1] + L.nodeW} y1={L.spineY} x2={L.branchX[2]} y2={L.spineY} className="eta-line-yes" />
                {/* B3 → Success */}
                <line x1={L.branchX[2] + L.nodeW} y1={L.spineY} x2={L.successCx - L.successR} y2={L.spineY} className="eta-line-yes" />

                {/* YES label midpoints */}
                {[
                    [(L.rootX + L.nodeW + L.branchX[0]) / 2, L.spineY - 7],
                    [(L.branchX[0] + L.nodeW + L.branchX[1]) / 2, L.spineY - 7],
                    [(L.branchX[1] + L.nodeW + L.branchX[2]) / 2, L.spineY - 7],
                    [(L.branchX[2] + L.nodeW + L.successCx - L.successR) / 2, L.spineY - 7],
                ].map(([x, y], i) => (
                    <text key={i} x={x} y={y} textAnchor="middle" className="eta-label-yes">YES ›</text>
                ))}

                {/* ── NO drop lines (branch → failure circle) ──────────── */}
                {branches.map((b, i) => {
                    const fp = L.failPos[i];
                    const midY = bBottom + (fp.cy - fp.r - bBottom) / 2;
                    return (
                        <g key={`no-${i}`}>
                            <line
                                x1={bCx[i]} y1={bBottom}
                                x2={fp.cx} y2={fp.cy - fp.r}
                                className="eta-line-no"
                            />
                            <text x={bCx[i] + 6} y={midY} className="eta-label-no">NO ↓</text>
                        </g>
                    );
                })}

                {/* ── Root node (initiating event) ────────────────────── */}
                <g>
                    <rect
                        x={L.rootX} y={bTop}
                        width={L.nodeW} height={L.nodeH}
                        rx={L.nodeRx}
                        fill="#3a3a5c" stroke="#22224a" strokeWidth="2"
                    />
                    <NodeText
                        x={L.rootX} y={bTop}
                        w={L.nodeW} h={L.nodeH}
                        text={initiatingEvent}
                        mystery={false}
                    />
                </g>

                {/* ── Branch nodes (b1, b2, b3) ────────────────────────── */}
                {branches.map((b, i) => {
                    const x = L.branchX[i];
                    const mystery = isMysterious(b.id);
                    const { fill, stroke, dash } = fillOf('branch', b.id);
                    return (
                        <g key={b.id} {...clickProps(b.id)}>
                            <rect
                                x={x} y={bTop}
                                width={L.nodeW} height={L.nodeH}
                                rx={L.nodeRx}
                                fill={fill} stroke={stroke} strokeWidth="2"
                                strokeDasharray={dash}
                                className={mystery ? 'eta-node--hidden' : (revealedSet.has(b.id) ? 'eta-node--revealed' : '')}
                            />
                            <NodeText
                                x={x} y={bTop}
                                w={L.nodeW} h={L.nodeH}
                                text={mystery ? '???' : b.label}
                                mystery={mystery}
                            />
                        </g>
                    );
                })}

                {/* ── Success outcome (circle) ─────────────────────────── */}
                {successOutcome && (() => {
                    const mystery = isMysterious(successOutcome.id);
                    const { fill, stroke, dash } = fillOf('success', successOutcome.id);
                    const r = L.successR;
                    return (
                        <g {...clickProps(successOutcome.id)}>
                            <circle
                                cx={L.successCx} cy={L.successCy} r={r}
                                fill={fill} stroke={stroke} strokeWidth="2"
                                strokeDasharray={dash}
                                className={mystery ? 'eta-node--hidden' : (revealedSet.has(successOutcome.id) ? 'eta-node--revealed' : '')}
                            />
                            <NodeText
                                x={L.successCx - r} y={L.successCy - r}
                                w={r * 2} h={r * 2}
                                text={mystery ? '???' : successOutcome.label}
                                mystery={mystery}
                            />
                        </g>
                    );
                })()}

                {/* ── Failure outcomes (circles below each branch) ─────── */}
                {failOutcomes.map((outcome, i) => {
                    if (!outcome) return null;
                    const fp = L.failPos[i];
                    const mystery = isMysterious(outcome.id);
                    const { fill, stroke, dash } = fillOf('failure', outcome.id);
                    return (
                        <g key={outcome.id} {...clickProps(outcome.id)}>
                            <circle
                                cx={fp.cx} cy={fp.cy} r={fp.r}
                                fill={fill} stroke={stroke} strokeWidth="2"
                                strokeDasharray={dash}
                                className={mystery ? 'eta-node--hidden' : (revealedSet.has(outcome.id) ? 'eta-node--revealed' : '')}
                            />
                            <NodeText
                                x={fp.cx - fp.r} y={fp.cy - fp.r}
                                w={fp.r * 2} h={fp.r * 2}
                                text={mystery ? '???' : outcome.label}
                                mystery={mystery}
                            />
                        </g>
                    );
                })}

                {/* ── Legend ─────────────────────────────────────────────── */}
                <g transform="translate(20, 560)">
                    <rect x="0" y="0" width="14" height="14" rx="2" fill="#2d5a8e" />
                    <text x="18" y="11" className="eta-legend-text">Branch (YES/NO decision)</text>
                    <rect x="170" y="0" width="14" height="14" rx="2" fill="#2e7d32" />
                    <text x="188" y="11" className="eta-legend-text">Success outcome</text>
                    <rect x="330" y="0" width="14" height="14" rx="2" fill="#b71c1c" />
                    <text x="348" y="11" className="eta-legend-text">Failure outcome</text>
                    <rect x="490" y="0" width="14" height="14" rx="2" fill="#555" strokeDasharray="4 2" stroke="#333" strokeWidth="1.5" />
                    <text x="508" y="11" className="eta-legend-text">Hidden node (click to answer)</text>
                </g>
            </svg>
        </div>
    );
}
