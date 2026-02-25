<?php
declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db.php';

function json_input_reports(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function require_auth(): array
{
    if (!isset($_SESSION['user'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Not authenticated.']);
        exit;
    }

    return $_SESSION['user'];
}

function respond_reports(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($payload);
    exit;
}

function handle_get_reports(): void
{
    $user = require_auth();
    $pdo = get_pdo();

    $scope = isset($_GET['scope']) ? $_GET['scope'] : 'user';

    if ($scope === 'admin') {
        if ($user['role'] !== 'admin') {
            respond_reports(['error' => 'Forbidden.'], 403);
        }

        $conditions = [];
        $params     = [];

        if (!empty($_GET['severity'])) {
            $conditions[]      = 'severity = :severity';
            $params['severity'] = $_GET['severity'];
        }

        if (!empty($_GET['hazard_type'])) {
            $conditions[]          = 'hazard_type = :hazard_type';
            $params['hazard_type'] = $_GET['hazard_type'];
        }

        $sql = 'SELECT id, user_id, location, hazard_type, severity, description, reporter_name, created_at
                FROM reports';

        if ($conditions) {
            $sql .= ' WHERE ' . implode(' AND ', $conditions);
        }

        $sql .= ' ORDER BY created_at DESC';

        $stmt = $pdo->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue(':' . $key, $value);
        }
        $stmt->execute();

        $rows = $stmt->fetchAll();
        respond_reports(['reports' => $rows]);
    }

    $stmt = $pdo->prepare(
        'SELECT id, user_id, location, hazard_type, severity, description, reporter_name, created_at
         FROM reports
         WHERE user_id = :user_id
         ORDER BY created_at DESC'
    );
    $stmt->execute([':user_id' => (int) $user['id']]);
    $rows = $stmt->fetchAll();

    respond_reports(['reports' => $rows]);
}

function handle_post_report(): void
{
    $user = require_auth();
    $pdo  = get_pdo();

    $data = json_input_reports();

    $location      = isset($data['location']) ? trim((string) $data['location']) : '';
    $hazardType    = isset($data['hazard_type']) ? trim((string) $data['hazard_type']) : '';
    $severity      = isset($data['severity']) ? trim((string) $data['severity']) : '';
    $description   = isset($data['description']) ? trim((string) $data['description']) : '';
    $reporterName  = isset($data['reporter_name']) ? trim((string) $data['reporter_name']) : '';

    if ($location === '' || $hazardType === '' || $severity === '') {
        respond_reports(['error' => 'Location, hazard type, and severity are required.'], 400);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO reports (user_id, location, hazard_type, severity, description, reporter_name, created_at)
         VALUES (:user_id, :location, :hazard_type, :severity, :description, :reporter_name, NOW())'
    );

    $stmt->execute([
        ':user_id'      => (int) $user['id'],
        ':location'     => $location,
        ':hazard_type'  => $hazardType,
        ':severity'     => $severity,
        ':description'  => $description,
        ':reporter_name'=> $reporterName,
    ]);

    log_activity(
        (int) $user['id'],
        'submitted_report',
        sprintf('Reported "%s" (%s) at "%s".', $hazardType, $severity, $location)
    );

    respond_reports(['message' => 'Report submitted successfully.']);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    handle_get_reports();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    handle_post_report();
}

respond_reports(['error' => 'Not found.'], 404);