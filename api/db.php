<?php
/**
 * PDO database connection. Reads credentials from .config.json at the project root.
 * Exposes $pdo and $appConfig to the including file.
 *
 * @license CC BY-NC-SA 4.0 — Simon Rundell / CodeMonkey Design
 */
$configPath = __DIR__ . '/../.config.json';

if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode(['error' => '.config.json not found']);
    exit();
}

$appConfig = json_decode(file_get_contents($configPath), true);

if (!$appConfig) {
    http_response_code(500);
    echo json_encode(['error' => 'Invalid .config.json']);
    exit();
}

$db = $appConfig['db'];

try {
    $pdo = new PDO(
        "mysql:host={$db['host']};dbname={$db['name']};charset=utf8mb4",
        $db['user'],
        $db['password'],
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit();
}
