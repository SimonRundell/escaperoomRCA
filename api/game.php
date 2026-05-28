<?php
/**
 * Game API — handles game creation (via Gemini), state retrieval, and status control.
 *
 * Actions (GET/POST ?action=...):
 *   create           POST  — Generate a new game via Gemini, return game code
 *   state            GET   — Student-safe game state (no correct answers)
 *   teacher_state    GET   — Full game state including correct answers
 *   update_status    POST  — Change game status: active | paused | ended
 *
 * @license CC BY-NC-SA 4.0 — Simon Rundell / CodeMonkey Design
 */

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {
    case 'create':        handleCreate(); break;
    case 'state':         handleState(false); break;
    case 'teacher_state': handleState(true); break;
    case 'update_status': handleUpdateStatus(); break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action']);
}

// ---------------------------------------------------------------------------

/**
 * Calls Gemini to generate a scenario, stores it, returns the game code.
 */
function handleCreate(): void {
    global $pdo, $appConfig;

    $scenario = generateScenarioViaGemini($appConfig['gemini']);
    if (!$scenario) {
        http_response_code(502);
        echo json_encode(['error' => 'Gemini scenario generation failed']);
        return;
    }

    // Validate minimum required fields
    if (
        empty($scenario['branches']) || count($scenario['branches']) !== 3 ||
        empty($scenario['outcomes']) || count($scenario['outcomes']) !== 4 ||
        empty($scenario['hiddenNodeIds']) || count($scenario['hiddenNodeIds']) !== 3 ||
        empty($scenario['questions'])
    ) {
        http_response_code(502);
        echo json_encode(['error' => 'Gemini returned an invalid scenario structure']);
        return;
    }

    $code = generateGameCode();
    $stmt = $pdo->prepare(
        'INSERT INTO games (code, scenario_json) VALUES (?, ?)'
    );
    $stmt->execute([$code, json_encode($scenario)]);

    echo json_encode(['success' => true, 'code' => $code, 'scenario' => $scenario]);
}

/**
 * Returns game state. When $teacherView is false, correct answers are stripped
 * from the scenario so students cannot read them from the network tab.
 */
function handleState(bool $teacherView): void {
    global $pdo;

    $code = $_GET['code'] ?? '';
    if (!$code) { http_response_code(400); echo json_encode(['error' => 'code required']); return; }

    $stmt = $pdo->prepare('SELECT * FROM games WHERE code = ?');
    $stmt->execute([$code]);
    $game = $stmt->fetch();

    if (!$game) { http_response_code(404); echo json_encode(['error' => 'Game not found']); return; }

    $scenario = json_decode($game['scenario_json'], true);

    // Strip answers for student view
    if (!$teacherView && isset($scenario['questions'])) {
        foreach ($scenario['questions'] as $nodeId => &$q) {
            unset($q['correctIndex'], $q['explanation']);
        }
        unset($q);
    }

    // Players + their revealed nodes
    $players = fetchPlayersWithProgress((int)$game['id']);

    // Calculate elapsed seconds
    $elapsed = null;
    if ($game['started_at']) {
        $end = $game['ended_at'] ?? date('Y-m-d H:i:s');
        $elapsed = strtotime($end) - strtotime($game['started_at']);
    }

    echo json_encode([
        'game' => [
            'id'         => (int)$game['id'],
            'code'       => $game['code'],
            'status'     => $game['status'],
            'elapsedSeconds' => $elapsed,
            'startedAt'  => $game['started_at'],
        ],
        'scenario' => $scenario,
        'players'  => $players,
        'leaderboard' => buildLeaderboard($players, $scenario['hiddenNodeIds']),
    ]);
}

/**
 * Changes game status (active/paused/ended).
 */
function handleUpdateStatus(): void {
    global $pdo;

    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $code   = $body['code']   ?? '';
    $status = $body['status'] ?? '';

    if (!in_array($status, ['active', 'paused', 'ended'], true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid status']);
        return;
    }

    $extra = '';
    if ($status === 'active') {
        // Only set started_at the first time
        $check = $pdo->prepare('SELECT started_at FROM games WHERE code = ?');
        $check->execute([$code]);
        $row = $check->fetch();
        if ($row && !$row['started_at']) {
            $extra = ', started_at = NOW()';
        }
    } elseif ($status === 'ended') {
        $extra = ', ended_at = NOW()';
    }

    $stmt = $pdo->prepare("UPDATE games SET status = ? {$extra} WHERE code = ?");
    $stmt->execute([$status, $code]);

    echo json_encode(['success' => true, 'status' => $status]);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetches all players for a game, including their revealed node IDs.
 */
function fetchPlayersWithProgress(int $gameId): array {
    global $pdo;

    $stmt = $pdo->prepare('SELECT * FROM players WHERE game_id = ? ORDER BY joined_at');
    $stmt->execute([$gameId]);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$player) {
        $prog = $pdo->prepare(
            'SELECT node_id, attempts, hints_used, revealed_at
             FROM node_progress WHERE player_id = ?'
        );
        $prog->execute([$player['id']]);
        $player['nodeProgress'] = $prog->fetchAll();
        $player['revealedNodes'] = array_column(
            array_filter($player['nodeProgress'], fn($p) => $p['revealed_at'] !== null),
            'node_id'
        );
        $player['id'] = (int)$player['id'];
        $player['game_id'] = (int)$player['game_id'];
        $player['total_penalty_seconds'] = (int)$player['total_penalty_seconds'];
    }
    unset($player);

    return $rows;
}

/**
 * Builds a leaderboard sorted by escape time + penalties (ascending).
 * Non-escaped players are shown at the bottom sorted by progress.
 */
function buildLeaderboard(array $players, array $hiddenNodeIds): array {
    $escaped = [];
    $inProgress = [];

    foreach ($players as $p) {
        $revealedCount = count($p['revealedNodes']);
        if ($p['escaped_at']) {
            $escaped[] = [
                'playerId'       => $p['id'],
                'name'           => $p['name'],
                'escaped'        => true,
                'escapedAt'      => $p['escaped_at'],
                'penaltySeconds' => $p['total_penalty_seconds'],
                'nodesRevealed'  => $revealedCount,
                'totalNodes'     => count($hiddenNodeIds),
            ];
        } else {
            $inProgress[] = [
                'playerId'       => $p['id'],
                'name'           => $p['name'],
                'escaped'        => false,
                'escapedAt'      => null,
                'penaltySeconds' => $p['total_penalty_seconds'],
                'nodesRevealed'  => $revealedCount,
                'totalNodes'     => count($hiddenNodeIds),
            ];
        }
    }

    // Sort escaped by escaped_at + penalty (both in seconds from game start)
    usort($escaped, fn($a, $b) =>
        (strtotime($a['escapedAt']) + $a['penaltySeconds']) -
        (strtotime($b['escapedAt']) + $b['penaltySeconds'])
    );

    // Sort in-progress by nodes revealed desc
    usort($inProgress, fn($a, $b) => $b['nodesRevealed'] - $a['nodesRevealed']);

    $board = array_merge($escaped, $inProgress);
    foreach ($board as $i => &$entry) {
        $entry['rank'] = $i + 1;
    }
    unset($entry);

    return $board;
}

/**
 * Generates a random 6-character uppercase alphanumeric game code.
 * Retries on collision (extremely rare).
 */
function generateGameCode(): string {
    global $pdo;
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit 0/O/1/I for clarity
    do {
        $code = '';
        for ($i = 0; $i < 6; $i++) {
            $code .= $chars[random_int(0, strlen($chars) - 1)];
        }
        $check = $pdo->prepare('SELECT id FROM games WHERE code = ?');
        $check->execute([$code]);
    } while ($check->fetch());
    return $code;
}

/**
 * Calls the Gemini API to generate a fresh ETA scenario.
 * Returns parsed scenario array or null on failure.
 */
function generateScenarioViaGemini(array $geminiConfig): ?array {
    $apiKey = $geminiConfig['apiKey'];
    $model  = $geminiConfig['model'] ?? 'gemini-2.5-flash';
    $url    = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

    $prompt = buildGeminiPrompt();

    $payload = json_encode([
        'contents' => [
            ['parts' => [['text' => $prompt]]]
        ],
        'generationConfig' => [
            'responseMimeType' => 'application/json',
            'temperature'      => 0.85,
            'maxOutputTokens'  => 2048,
        ],
    ]);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 30,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$response) {
        return null;
    }

    $result = json_decode($response, true);
    $text   = $result['candidates'][0]['content']['parts'][0]['text'] ?? null;

    if (!$text) {
        return null;
    }

    $scenario = json_decode($text, true);
    return is_array($scenario) ? $scenario : null;
}

/**
 * Returns the Gemini prompt for generating an ETA escape room scenario.
 */
function buildGeminiPrompt(): string {
    return <<<PROMPT
You are an educational game designer creating a Fault Tree Escape Room for IT students aged 16-19 studying T-Level Digital: Software Development. The topic is Event Tree Analysis (ETA).

Generate an IT incident scenario with a CHAIN-STRUCTURED ETA containing exactly 3 branch nodes (b1, b2, b3). Each branch has a YES path (continues the chain) and a NO path (goes to a failure outcome).

Return ONLY raw JSON — no markdown, no code fences, no explanation. Match this exact schema:

{
  "title": "Short catchy incident title (5-8 words)",
  "context": "2-3 sentence background describing the IT system and what went wrong.",
  "initiatingEvent": "One sentence describing what triggers the ETA chain.",
  "branches": [
    {"id": "b1", "label": "First YES/NO question (max 7 words)?", "noOutcomeId": "e1"},
    {"id": "b2", "label": "Second YES/NO question (max 7 words)?", "noOutcomeId": "e2"},
    {"id": "b3", "label": "Third YES/NO question (max 7 words)?", "noOutcomeId": "e3"}
  ],
  "outcomes": [
    {"id": "e_success", "label": "Successful resolution (max 8 words)", "type": "success"},
    {"id": "e1", "label": "Failure when branch 1 is NO (max 8 words)", "type": "failure"},
    {"id": "e2", "label": "Failure when branch 2 is NO (max 8 words)", "type": "failure"},
    {"id": "e3", "label": "Failure when branch 3 is NO (max 8 words)", "type": "failure"}
  ],
  "hiddenNodeIds": ["b2", "e2", "b3"],
  "questions": {
    "b2": {
      "question": "Question testing understanding of what this branch checks (max 20 words)?",
      "options": ["Correct answer here", "Plausible wrong answer", "Plausible wrong answer", "Plausible wrong answer"],
      "correctIndex": 0,
      "explanation": "1-2 sentences explaining why the correct answer is right and linking to ETA/IT concepts."
    },
    "e2": {
      "question": "Question about this failure outcome or what causes it (max 20 words)?",
      "options": ["Plausible wrong answer", "Plausible wrong answer", "Correct answer here", "Plausible wrong answer"],
      "correctIndex": 2,
      "explanation": "1-2 sentences explaining this outcome and its significance in the ETA."
    },
    "b3": {
      "question": "Question about this branch's role in the system or ETA (max 20 words)?",
      "options": ["Plausible wrong answer", "Correct answer here", "Plausible wrong answer", "Plausible wrong answer"],
      "correctIndex": 1,
      "explanation": "1-2 sentences connecting this branch to the wider IT scenario and ETA principles."
    }
  }
}

RULES:
- hiddenNodeIds must contain exactly 3 IDs (any mix of b1/b2/b3/e1/e2/e3/e_success is fine, but e_success hidden is discouraged)
- questions must have exactly one entry per ID in hiddenNodeIds
- Branch labels must be YES/NO questions ending with ?
- options must have exactly 4 strings
- correctIndex must be 0, 1, 2, or 3
- Vary the scenario each call: authentication, deployments, database outages, network faults, security incidents, cloud services, CI/CD pipelines
- Questions must be educational — testing ETA understanding and relevant IT knowledge
PROMPT;
}
