<?php
/**
 * Progress API — answer submission, hint usage, leaderboard.
 *
 * Actions:
 *   answer       POST  — Submit an answer for a hidden node
 *   hint         POST  — Request a hint (adds time penalty)
 *   leaderboard  GET   — Current leaderboard for a game
 *
 * @license CC BY-NC-SA 4.0 — Simon Rundell / CodeMonkey Design
 */

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {
    case 'answer':      handleAnswer(); break;
    case 'hint':        handleHint(); break;
    case 'leaderboard': handleLeaderboard(); break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action']);
}

// ---------------------------------------------------------------------------

/**
 * Validates an answer for a hidden node. Correct answers reveal the node.
 * Wrong answers add wrongAnswerPenaltySeconds to the player's total.
 */
function handleAnswer(): void {
    global $pdo, $appConfig;

    $body       = json_decode(file_get_contents('php://input'), true) ?? [];
    $playerId   = (int)($body['playerId'] ?? 0);
    $nodeId     = $body['nodeId'] ?? '';
    $optionIndex = (int)($body['optionIndex'] ?? -1);

    if (!$playerId || !$nodeId || $optionIndex < 0) {
        http_response_code(400);
        echo json_encode(['error' => 'playerId, nodeId, optionIndex required']);
        return;
    }

    // Load game via player
    $gameStmt = $pdo->prepare(
        "SELECT g.id, g.status, g.scenario_json, g.started_at, p.escaped_at, p.total_penalty_seconds
         FROM players p JOIN games g ON g.id = p.game_id
         WHERE p.id = ?"
    );
    $gameStmt->execute([$playerId]);
    $row = $gameStmt->fetch();

    if (!$row) { http_response_code(404); echo json_encode(['error' => 'Player not found']); return; }
    if ($row['status'] !== 'active') { http_response_code(409); echo json_encode(['error' => 'Game is not active']); return; }
    if ($row['escaped_at']) { http_response_code(409); echo json_encode(['error' => 'Already escaped']); return; }

    $scenario = json_decode($row['scenario_json'], true);

    // Verify nodeId is actually hidden in this game
    if (!in_array($nodeId, $scenario['hiddenNodeIds'], true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Node is not hidden in this game']);
        return;
    }

    // Check not already revealed
    $already = $pdo->prepare(
        "SELECT revealed_at FROM node_progress WHERE player_id = ? AND node_id = ?"
    );
    $already->execute([$playerId, $nodeId]);
    $existing = $already->fetch();
    if ($existing && $existing['revealed_at']) {
        echo json_encode(['correct' => true, 'alreadyRevealed' => true]);
        return;
    }

    $correctIndex = $scenario['questions'][$nodeId]['correctIndex'] ?? -1;
    $explanation  = $scenario['questions'][$nodeId]['explanation']  ?? '';
    $isCorrect    = ($optionIndex === (int)$correctIndex);

    $penaltyCfg = $appConfig['game'];

    if ($existing) {
        // Update existing progress row
        if ($isCorrect) {
            $pdo->prepare(
                "UPDATE node_progress SET attempts = attempts + 1, revealed_at = NOW()
                 WHERE player_id = ? AND node_id = ?"
            )->execute([$playerId, $nodeId]);
        } else {
            $pdo->prepare(
                "UPDATE node_progress SET attempts = attempts + 1
                 WHERE player_id = ? AND node_id = ?"
            )->execute([$playerId, $nodeId]);
            // Add wrong-answer penalty
            $pdo->prepare(
                "UPDATE players SET total_penalty_seconds = total_penalty_seconds + ?
                 WHERE id = ?"
            )->execute([$penaltyCfg['wrongAnswerPenaltySeconds'], $playerId]);
        }
    } else {
        // First attempt on this node
        $pdo->prepare(
            "INSERT INTO node_progress (player_id, node_id, attempts, revealed_at)
             VALUES (?, ?, 1, " . ($isCorrect ? 'NOW()' : 'NULL') . ")"
        )->execute([$playerId, $nodeId]);
        if (!$isCorrect) {
            $pdo->prepare(
                "UPDATE players SET total_penalty_seconds = total_penalty_seconds + ? WHERE id = ?"
            )->execute([$penaltyCfg['wrongAnswerPenaltySeconds'], $playerId]);
        }
    }

    // Check if all nodes are now revealed → mark as escaped
    if ($isCorrect) {
        $revealedStmt = $pdo->prepare(
            "SELECT COUNT(*) as cnt FROM node_progress
             WHERE player_id = ? AND revealed_at IS NOT NULL"
        );
        $revealedStmt->execute([$playerId]);
        $revealedCount = (int)$revealedStmt->fetch()['cnt'];

        if ($revealedCount >= count($scenario['hiddenNodeIds'])) {
            $pdo->prepare(
                "UPDATE players SET escaped_at = NOW() WHERE id = ?"
            )->execute([$playerId]);
        }
    }

    echo json_encode([
        'correct'     => $isCorrect,
        'explanation' => $isCorrect ? $explanation : null,
        'penalty'     => $isCorrect ? 0 : (int)$penaltyCfg['wrongAnswerPenaltySeconds'],
    ]);
}

/**
 * Applies a hint penalty to the player and returns the explanation text.
 * Limited to maxHintsPerNode per node per player.
 */
function handleHint(): void {
    global $pdo, $appConfig;

    $body     = json_decode(file_get_contents('php://input'), true) ?? [];
    $playerId = (int)($body['playerId'] ?? 0);
    $nodeId   = $body['nodeId'] ?? '';

    if (!$playerId || !$nodeId) {
        http_response_code(400);
        echo json_encode(['error' => 'playerId and nodeId required']);
        return;
    }

    // Validate game/player active
    $gameStmt = $pdo->prepare(
        "SELECT g.status, g.scenario_json
         FROM players p JOIN games g ON g.id = p.game_id WHERE p.id = ?"
    );
    $gameStmt->execute([$playerId]);
    $row = $gameStmt->fetch();

    if (!$row || $row['status'] !== 'active') {
        http_response_code(409);
        echo json_encode(['error' => 'Game is not active']);
        return;
    }

    $scenario    = json_decode($row['scenario_json'], true);
    $penaltyCfg  = $appConfig['game'];
    $maxHints    = (int)($penaltyCfg['maxHintsPerNode'] ?? 2);
    $hintPenalty = (int)($penaltyCfg['hintPenaltySeconds'] ?? 30);

    // Check hint usage for this node
    $progStmt = $pdo->prepare(
        "SELECT hints_used FROM node_progress WHERE player_id = ? AND node_id = ?"
    );
    $progStmt->execute([$playerId, $nodeId]);
    $prog = $progStmt->fetch();
    $hintsUsed = $prog ? (int)$prog['hints_used'] : 0;

    if ($hintsUsed >= $maxHints) {
        echo json_encode(['error' => 'No more hints available for this node', 'hintsUsed' => $hintsUsed]);
        return;
    }

    // Apply penalty
    $pdo->prepare(
        "UPDATE players SET total_penalty_seconds = total_penalty_seconds + ? WHERE id = ?"
    )->execute([$hintPenalty, $playerId]);

    // Increment hints_used
    if ($prog) {
        $pdo->prepare(
            "UPDATE node_progress SET hints_used = hints_used + 1 WHERE player_id = ? AND node_id = ?"
        )->execute([$playerId, $nodeId]);
    } else {
        $pdo->prepare(
            "INSERT INTO node_progress (player_id, node_id, hints_used) VALUES (?, ?, 1)"
        )->execute([$playerId, $nodeId]);
    }

    // Return the hint (first sentence of explanation)
    $explanation = $scenario['questions'][$nodeId]['explanation'] ?? '';
    $hint = explode('.', $explanation)[0] . '.';

    echo json_encode([
        'hint'        => $hint,
        'penalty'     => $hintPenalty,
        'hintsUsed'   => $hintsUsed + 1,
        'hintsLeft'   => $maxHints - $hintsUsed - 1,
    ]);
}

/**
 * Returns the live leaderboard for a game code.
 */
function handleLeaderboard(): void {
    global $pdo;

    $code = $_GET['code'] ?? '';
    if (!$code) { http_response_code(400); echo json_encode(['error' => 'code required']); return; }

    $stmt = $pdo->prepare(
        "SELECT g.scenario_json, g.started_at, g.status,
                p.id, p.name, p.escaped_at, p.total_penalty_seconds
         FROM games g JOIN players p ON p.game_id = g.id
         WHERE g.code = ?
         ORDER BY p.joined_at"
    );
    $stmt->execute([$code]);
    $rows = $stmt->fetchAll();

    if (!$rows) {
        echo json_encode(['leaderboard' => []]);
        return;
    }

    $scenario   = json_decode($rows[0]['scenario_json'], true);
    $startedAt  = $rows[0]['started_at'];
    $hiddenCount = count($scenario['hiddenNodeIds'] ?? []);
    $gameStatus  = $rows[0]['status'];

    $board = [];
    foreach ($rows as $r) {
        // Count revealed nodes
        $progStmt = $pdo->prepare(
            "SELECT COUNT(*) as cnt FROM node_progress
             WHERE player_id = ? AND revealed_at IS NOT NULL"
        );
        $progStmt->execute([$r['id']]);
        $revealed = (int)$progStmt->fetch()['cnt'];

        $escapeSeconds = null;
        if ($r['escaped_at'] && $startedAt) {
            $escapeSeconds = strtotime($r['escaped_at']) - strtotime($startedAt) + (int)$r['total_penalty_seconds'];
        }

        $board[] = [
            'playerId'       => (int)$r['id'],
            'name'           => $r['name'],
            'escaped'        => (bool)$r['escaped_at'],
            'escapeSeconds'  => $escapeSeconds,
            'penaltySeconds' => (int)$r['total_penalty_seconds'],
            'nodesRevealed'  => $revealed,
            'totalNodes'     => $hiddenCount,
        ];
    }

    // Sort: escaped (by time asc) first, then in-progress (by nodes desc)
    usort($board, function ($a, $b) {
        if ($a['escaped'] && $b['escaped']) return $a['escapeSeconds'] - $b['escapeSeconds'];
        if ($a['escaped']) return -1;
        if ($b['escaped']) return 1;
        return $b['nodesRevealed'] - $a['nodesRevealed'];
    });

    foreach ($board as $i => &$entry) { $entry['rank'] = $i + 1; }
    unset($entry);

    echo json_encode(['leaderboard' => $board, 'gameStatus' => $gameStatus]);
}
