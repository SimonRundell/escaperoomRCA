<?php
/**
 * Player API — join a game, list players.
 *
 * Actions:
 *   join   POST  — Join a game by code + name, returns player_id
 *   list   GET   — List all players for a game code
 *
 * @license CC BY-NC-SA 4.0 — Simon Rundell / CodeMonkey Design
 */

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {
    case 'join': handleJoin(); break;
    case 'list': handleList(); break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action']);
}

// ---------------------------------------------------------------------------

/**
 * Joins a game. If the player name already exists in this game, returns their
 * existing ID (supports page refresh / re-join).
 */
function handleJoin(): void {
    global $pdo;

    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $code = trim($body['code'] ?? '');
    $name = trim($body['name'] ?? '');

    if (!$code || !$name) {
        http_response_code(400);
        echo json_encode(['error' => 'code and name are required']);
        return;
    }

    // Validate game exists and is joinable
    $stmt = $pdo->prepare("SELECT id, status FROM games WHERE code = ?");
    $stmt->execute([$code]);
    $game = $stmt->fetch();

    if (!$game) {
        http_response_code(404);
        echo json_encode(['error' => 'Game not found']);
        return;
    }

    if ($game['status'] === 'ended') {
        http_response_code(409);
        echo json_encode(['error' => 'This game has ended']);
        return;
    }

    // Return existing player if they rejoin with the same name
    $exists = $pdo->prepare("SELECT id FROM players WHERE game_id = ? AND name = ?");
    $exists->execute([$game['id'], $name]);
    $existing = $exists->fetch();

    if ($existing) {
        echo json_encode([
            'success'  => true,
            'playerId' => (int)$existing['id'],
            'name'     => $name,
            'gameCode' => $code,
            'rejoin'   => true,
        ]);
        return;
    }

    $insert = $pdo->prepare("INSERT INTO players (game_id, name) VALUES (?, ?)");
    $insert->execute([$game['id'], $name]);

    echo json_encode([
        'success'  => true,
        'playerId' => (int)$pdo->lastInsertId(),
        'name'     => $name,
        'gameCode' => $code,
        'rejoin'   => false,
    ]);
}

/**
 * Lists all players for a game.
 */
function handleList(): void {
    global $pdo;

    $code = $_GET['code'] ?? '';
    if (!$code) { http_response_code(400); echo json_encode(['error' => 'code required']); return; }

    $stmt = $pdo->prepare(
        "SELECT p.id, p.name, p.joined_at, p.escaped_at, p.total_penalty_seconds
         FROM players p
         JOIN games g ON g.id = p.game_id
         WHERE g.code = ?
         ORDER BY p.joined_at"
    );
    $stmt->execute([$code]);
    echo json_encode(['players' => $stmt->fetchAll()]);
}
