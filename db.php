<?php

declare(strict_types=1);

const DB_HOST = '127.0.0.1';
const DB_NAME = 'rainsafe';
const DB_USER = 'root';
const DB_PASS = '';

function get_pdo(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);

    return $pdo;
}

function log_activity(int $userId, string $action, string $details = ''): void
{
    try {
        $pdo = get_pdo();
        $stmt = $pdo->prepare(
            'INSERT INTO activity_logs (user_id, action, details, created_at)
             VALUES (:user_id, :action, :details, NOW())'
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':action'  => $action,
            ':details' => $details,
        ]);
    } catch (Throwable $e) {
        error_log('Activity log failed: ' . $e->getMessage());
    }
}