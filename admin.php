<?php
/**
 * 留言管理页 — 只有你能看
 *
 * 使用前必做：把下面的 ADMIN_PASSWORD 改成自己的密码！
 * 部署后访问 https://你的域名/admin.php 登录查看、删除留言。
 *
 * 安全建议：
 * 1. 密码务必改掉，别用示例值；
 * 2. 更稳妥的做法是给 admin.php 再加一层 HTTP Basic Auth（宝塔：网站设置 → 密码访问）；
 * 3. 本页不会出现在博客任何链接里，但 URL 本身请别外传。
 */
session_start();

$ADMIN_PASSWORD = 'changeme';   // TODO: 改成你自己的密码！
$MESSAGES = __DIR__ . '/data/messages.json.php';
$FAIL_FILE = __DIR__ . '/data/login_failures.json.php';
$MAX_FAILS = 5;                 // 连续失败次数上限
$LOCK_MINUTES = 10;             // 达到上限后的锁定时长（分钟）

function load_failures($path) {
    if (!is_file($path)) return array();
    $raw = (string)file_get_contents($path);
    $raw = preg_replace('/^<\?php.*?\?>\s*/s', '', $raw);
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : array();
}

function load_messages($path) {
    if (!is_file($path)) return array();
    $raw = (string)file_get_contents($path);
    $raw = preg_replace('/^<\?php.*?\?>\s*/s', '', $raw);
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : array();
}

/* ── 登录失败限速：连错 $MAX_FAILS 次锁 $LOCK_MINUTES 分钟 ── */
$now = time();
$fails = array_values(array_filter(load_failures($FAIL_FILE), function ($ts) use ($now, $LOCK_MINUTES) {
    return $ts > $now - $LOCK_MINUTES * 60;
}));
$locked = count($fails) >= $MAX_FAILS;
$unlock_in = $locked ? (int)ceil((min($fails) + $LOCK_MINUTES * 60 - $now) / 60) : 0;

$just_logged = false;
$login_error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password']) && !$locked) {
    if ($_POST['password'] === $ADMIN_PASSWORD) {
        $_SESSION['gb_admin'] = true;
        @unlink($FAIL_FILE);          // 登录成功清空失败记录
        $just_logged = true;
    } else {
        $fails[] = $now;
        file_put_contents($FAIL_FILE,
            "<?php die('forbidden'); ?>\n" . json_encode($fails), LOCK_EX);
        sleep(1);                     // 每次失败拖 1 秒，增加爆破成本
        $login_error = '密码不对，还剩 ' . ($MAX_FAILS - count($fails)) . ' 次机会';
    }
}
$authed = !empty($_SESSION['gb_admin']);

if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: admin.php');
    exit;
}

/* 登录后：删除 / 清空（PRG 模式防重复提交） */
$flash = '';
if ($authed && $_SERVER['REQUEST_METHOD'] === 'POST' && !$just_logged) {
    $messages = load_messages($MESSAGES);
    $action = $_POST['action'] ?? '';
    if ($action === 'delete' && isset($_POST['id'])) {
        $id = (string)$_POST['id'];
        $messages = array_values(array_filter($messages, function ($m) use ($id) {
            return ($m['id'] ?? '') !== $id;
        }));
        file_put_contents($MESSAGES,
            "<?php die('forbidden'); ?>\n" . json_encode($messages, JSON_UNESCAPED_UNICODE), LOCK_EX);
        $flash = '已删除 1 条留言';
    } elseif ($action === 'clear') {
        file_put_contents($MESSAGES, "<?php die('forbidden'); ?>\n[]", LOCK_EX);
        $flash = '已清空全部留言';
    }
    header('Location: admin.php?flash=' . urlencode($flash));
    exit;
}

$messages = $authed ? array_reverse(load_messages($MESSAGES)) : array();
$flash = $_GET['flash'] ?? '';
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>留言管理 — MyBlog</title>
<style>
  body { font-family: ui-monospace, "JetBrains Mono", Consolas, monospace;
         background: #101014; color: #EDEDF0; margin: 0; padding: 40px 20px; }
  .wrap { max-width: 760px; margin: 0 auto; }
  h1 { font-size: 20px; } h1 span { color: #D97C5C; }
  .flash { color: #28C840; margin: 12px 0; }
  .card { background: #15151A; border: 1px solid #2B2B33; border-radius: 12px;
          padding: 16px 18px; margin: 14px 0; }
  .meta { color: #8B8C94; font-size: 12px; margin-bottom: 8px; }
  .meta b { color: #E5906F; font-weight: 600; }
  .msg { white-space: pre-wrap; line-height: 1.7; font-size: 14px; }
  form.inline { display: inline; margin: 0; }
  button { font-family: inherit; font-size: 12px; color: #A6A7AE; background: none;
           border: 1px solid #2B2B33; border-radius: 999px; padding: 5px 14px;
           cursor: pointer; }
  button:hover { color: #E5906F; border-color: #E5906F; }
  button.danger:hover { color: #FF5F57; border-color: #FF5F57; }
  input[type=password] { font-family: inherit; font-size: 14px; color: #EDEDF0;
           background: #1C1C22; border: 1px solid #2B2B33; border-radius: 10px;
           padding: 10px 14px; width: 240px; }
  .bar { display: flex; justify-content: space-between; align-items: center;
         margin: 18px 0; }
  .empty { color: #8B8C94; padding: 40px 0; text-align: center; }
  a { color: #A6A7AE; font-size: 12px; }
</style>
</head>
<body>
<div class="wrap">
  <h1><span>$</span> 留言管理 <span>.log</span></h1>

<?php if (!$authed): ?>
  <form method="post" class="card" style="margin-top:24px">
    <p style="margin-bottom:12px;color:#8B8C94;font-size:13px">输入管理密码查看留言</p>
    <?php if ($locked): ?>
      <p style="color:#FF5F57;font-size:13px;margin-bottom:10px">
        失败次数过多，已临时锁定 — 请约 <?= $unlock_in ?> 分钟后再试
      </p>
    <?php elseif ($login_error): ?>
      <p style="color:#FEBC2E;font-size:13px;margin-bottom:10px"><?= htmlspecialchars($login_error) ?></p>
    <?php endif; ?>
    <input type="password" name="password" autofocus required <?= $locked ? 'disabled' : '' ?>>
    <button type="submit" style="margin-left:10px" <?= $locked ? 'disabled' : '' ?>>进入</button>
  </form>
<?php else: ?>
  <?php if ($flash): ?><p class="flash">✓ <?= htmlspecialchars($flash) ?></p><?php endif; ?>
  <div class="bar">
    <span style="color:#8B8C94;font-size:13px">共 <?= count($messages) ?> 条留言</span>
    <span>
      <form method="post" class="inline" onsubmit="return confirm('确定清空全部留言？')">
        <input type="hidden" name="action" value="clear">
        <button type="submit" class="danger">清空全部</button>
      </form>
      <a href="?logout">退出</a>
    </span>
  </div>

  <?php if (!$messages): ?>
    <p class="empty">还没有留言 — 去博客里给朋友宣传一下吧 :)</p>
  <?php endif; ?>

  <?php foreach ($messages as $m): ?>
    <div class="card">
      <div class="meta">
        <?= date('Y-m-d H:i', (int)($m['ts'] ?? 0)) ?>
        · <b><?= htmlspecialchars($m['name'] ?? 'anonymous') ?></b>
        · IP <?= htmlspecialchars($m['ip'] ?? '-') ?>
        <form method="post" class="inline" style="float:right">
          <input type="hidden" name="action" value="delete">
          <input type="hidden" name="id" value="<?= htmlspecialchars($m['id'] ?? '') ?>">
          <button type="submit" class="danger">删除</button>
        </form>
      </div>
      <div class="msg"><?= nl2br(htmlspecialchars($m['msg'] ?? '')) ?></div>
    </div>
  <?php endforeach; ?>
<?php endif; ?>
</div>
</body>
</html>
