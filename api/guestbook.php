<?php
/**
 * 留言接口 — 纯 PHP 单文件，无需数据库
 *
 * 前端留言 → 校验 → 追加保存到 data/messages.json.php
 * （文件头带 PHP 退出语句，即使被直接访问也只会输出 forbidden，防止泄露）
 *
 * 可选：填上 SERVERCHAN_SENDKEY 后，每条新留言会推送到你的微信
 * （Server酱 https://sct.ftqq.com 免费申请，微信里第一时间看到留言）
 *
 * 前端用 GET 请求探测本接口是否可用，可用则自动切换为服务端模式。
 */

header('Content-Type: application/json; charset=utf-8');

/* ──────── 配置 ──────── */
$SERVERCHAN_SENDKEY = '';      // Server酱 SendKey，留空则只保存不推送
$MAX_NAME   = 20;              // 昵称最长字符数
$MAX_MSG    = 300;             // 留言最长字符数
$COOLDOWN   = 60;              // 同一 IP 两次留言的最小间隔（秒）
/* ────────────────────── */

$DATA_DIR = __DIR__ . '/data';
$MESSAGES = $DATA_DIR . '/messages.json.php';

function respond($ok, $error = '') {
    echo json_encode(array('ok' => $ok, 'error' => $error), JSON_UNESCAPED_UNICODE);
    exit;
}

/* 读取留言文件，去掉防下载头后解析 JSON */
function load_messages($path) {
    if (!is_file($path)) return array();
    $raw = (string)file_get_contents($path);
    $raw = preg_replace('/^<\?php.*?\?>\s*/s', '', $raw);
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : array();
}

function save_messages($path, $messages) {
    $payload = "<?php die('forbidden'); ?>\n"
             . json_encode(array_values($messages), JSON_UNESCAPED_UNICODE);
    return file_put_contents($path, $payload, LOCK_EX) !== false;
}

if (!is_dir($DATA_DIR)) @mkdir($DATA_DIR, 0755, true);

/* 探测：证明本接口存在且 PHP 正常 */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    respond(true);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'method');
}

$body = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($body)) respond(false, 'bad_request');

/* 蜜罐字段：页面上对人隐藏，机器人会填 —— 假装成功但不保存 */
if (!empty($body['website'])) respond(true);

$name = trim((string)($body['name'] ?? ''));
$msg  = trim((string)($body['message'] ?? ''));
if ($msg === '') respond(false, 'empty');
if (function_exists('mb_substr')) {
    $name = mb_substr($name, 0, $MAX_NAME, 'UTF-8');
    $msg  = mb_substr($msg, 0, $MAX_MSG, 'UTF-8');
} else {
    $name = substr($name, 0, $MAX_NAME * 3);
    $msg  = substr($msg, 0, $MAX_MSG * 3);
}

$ip  = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$now = time();
$messages = load_messages($MESSAGES);

/* 简单限流：同一 IP 在冷却时间内只收一条（检查最近 10 条，防穿插绕过） */
$recent = array_slice($messages, -10);
foreach ($recent as $m) {
    if (($m['ip'] ?? '') === $ip && ($now - (int)($m['ts'] ?? 0)) < $COOLDOWN) {
        respond(false, 'rate');
    }
}

$entry = array(
    'id'   => bin2hex(random_bytes(8)),
    'name' => $name !== '' ? $name : 'anonymous',
    'msg'  => $msg,
    'ip'   => $ip,
    'ts'   => $now,
);
$messages[] = $entry;

if (!save_messages($MESSAGES, $messages)) {
    respond(false, 'storage');   // 多半是 data/ 目录不可写
}

/* 可选：推送到微信（Server酱） */
if ($SERVERCHAN_SENDKEY !== '') {
    $ctx = stream_context_create(array('http' => array(
        'method'  => 'POST',
        'header'  => "Content-Type: application/x-www-form-urlencoded\r\n",
        'content' => http_build_query(array(
            'title' => '博客新留言 · ' . $entry['name'],
            'desp'  => $entry['msg'] . "\n\nIP: " . $entry['ip'],
        )),
        'timeout' => 3,
        'ignore_errors' => true,
    )));
    @file_get_contents('https://sctapi.ftqq.com/' . urlencode($SERVERCHAN_SENDKEY) . '.send', false, $ctx);
}

respond(true);
