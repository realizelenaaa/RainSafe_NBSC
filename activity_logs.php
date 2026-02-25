<?php
declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db.php';

function require_auth_logs(): array
{
    if (!isset($_SESSION['user'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Not authenticated.']);
        exit;
    }

    return $_SESSION['user'];
}

function respond_logs(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($payload);
    exit;
}

function handle_get_logs(): void
{
    $user = require_auth_logs();
    $pdo  = get_pdo();

    $scope = isset($_GET['scope']) ? $_GET['scope'] : 'user';

    if ($scope === 'admin') {
        if ($user['role'] !== 'admin') {
            respond_logs(['error' => 'Forbidden.'], 403);
        }

        $stmt = $pdo->query(
            'SELECT al.id,
                    al.user_id,
                    u.email AS user_email,
                    al.action,
                    al.details,
                    al.created_at
             FROM activity_logs al
             LEFT JOIN users u ON u.id = al.user_id
             ORDER BY al.created_at DESC
             LIMIT 200'
        );
        $rows = $stmt->fetchAll();
        respond_logs(['logs' => $rows]);
    }

    // Default: logs for current user
    $stmt = $pdo->prepare(
        'SELECT id, user_id, action, details, created_at
         FROM activity_logs
         WHERE user_id = :user_id
         ORDER BY created_at DESC
         LIMIT 100'
    );
    $stmt->execute([':user_id' => (int) $user['id']]);
    $rows = $stmt->fetchAll();

    respond_logs(['logs' => $rows]);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    handle_get_logs();
}

respond_logs(['error' => 'Not found.'], 404);