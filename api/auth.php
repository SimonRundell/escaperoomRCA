<?php
/**
 * Teacher authentication API.
 *
 * Actions (via ?action=):
 *   login  — POST {username, password} → starts a PHP session
 *   logout — POST                      → destroys the session
 *   check  — GET                       → returns {loggedIn, username}
 *   setup  — POST {username, password} → creates the FIRST teacher account
 *                                        (blocked once any teacher exists)
 *
 * session_start() must run before any header output, so it is called
 * before including cors.php.
 *
 * @license CC BY-NC-SA 4.0 — Simon Rundell / CodeMonkey Design
 */
session_start();

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';
$body   = json_decode(file_get_contents('php://input'), true) ?? [];

switch ($action) {

    // ------------------------------------------------------------------
    // LOGIN
    // ------------------------------------------------------------------
    case 'login':
        $username = trim($body['username'] ?? '');
        $password = $body['password'] ?? '';

        if ($username === '' || $password === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Username and password are required']);
            exit();
        }

        $stmt = $pdo->prepare(
            'SELECT id, username, password_hash FROM teachers WHERE username = ? LIMIT 1'
        );
        $stmt->execute([$username]);
        $teacher = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$teacher || !password_verify($password, $teacher['password_hash'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid username or password']);
            exit();
        }

        // Rotate session ID on privilege escalation to prevent fixation.
        session_regenerate_id(true);
        $_SESSION['teacher_id']   = $teacher['id'];
        $_SESSION['teacher_name'] = $teacher['username'];

        echo json_encode(['loggedIn' => true, 'username' => $teacher['username']]);
        break;

    // ------------------------------------------------------------------
    // LOGOUT
    // ------------------------------------------------------------------
    case 'logout':
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(
                session_name(), '', time() - 42000,
                $p['path'], $p['domain'], $p['secure'], $p['httponly']
            );
        }
        session_destroy();
        echo json_encode(['loggedIn' => false]);
        break;

    // ------------------------------------------------------------------
    // CHECK (used by ProtectedTeacher on mount)
    // ------------------------------------------------------------------
    case 'check':
        echo json_encode([
            'loggedIn' => isset($_SESSION['teacher_id']),
            'username' => $_SESSION['teacher_name'] ?? null,
        ]);
        break;

    // ------------------------------------------------------------------
    // SETUP — create the very first teacher account
    // ------------------------------------------------------------------
    case 'setup':
        $count = (int) $pdo->query('SELECT COUNT(*) FROM teachers')->fetchColumn();
        if ($count > 0) {
            http_response_code(403);
            echo json_encode(['error' => 'Setup is already complete. Use the login page.']);
            exit();
        }

        $username = trim($body['username'] ?? '');
        $password = $body['password'] ?? '';

        if (strlen($username) < 3) {
            http_response_code(400);
            echo json_encode(['error' => 'Username must be at least 3 characters']);
            exit();
        }
        if (strlen($password) < 8) {
            http_response_code(400);
            echo json_encode(['error' => 'Password must be at least 8 characters']);
            exit();
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $pdo->prepare(
            'INSERT INTO teachers (username, password_hash) VALUES (?, ?)'
        );
        $stmt->execute([$username, $hash]);

        echo json_encode(['created' => true, 'username' => $username]);
        break;

    // ------------------------------------------------------------------
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action']);
}
