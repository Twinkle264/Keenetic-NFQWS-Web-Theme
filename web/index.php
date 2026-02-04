<?php

ini_set('memory_limit', '32M');

define('NFQWS_INSTALLED', file_exists('/opt/usr/bin/nfqws') || file_exists('/usr/bin/nfqws'));
define('NFQWS2_INSTALLED', file_exists('/opt/usr/bin/nfqws2') || file_exists('/usr/bin/nfqws2'));
define('ROOT_DIR', (file_exists('/opt/usr/bin/nfqws2') || file_exists('/opt/usr/bin/nfqws')) ? '/opt' : '');

function getScriptName(string $version): string {
    if (ROOT_DIR) {
        return $version === 'nfqws2' ? 'S51nfqws2' : 'S51nfqws';
    }
    return $version === 'nfqws2' ? 'nfqws2-keenetic' : 'nfqws-keenetic';
}

function getPaths(string $version): array {
    if ($version === 'nfqws2') {
        return [
            'conf_dir' => '/etc/nfqws2',
            'lists_dir' => '/etc/nfqws2/lists',
            'log_file' => '/var/log/nfqws2.log',
            'primary_conf' => 'nfqws2.conf',
            'log_name' => 'nfqws2.log'
        ];
    }
    return [
        'conf_dir' => '/etc/nfqws',
        'lists_dir' => '/etc/nfqws',
        'log_file' => '/var/log/nfqws.log',
        'primary_conf' => 'nfqws.conf',
        'log_name' => 'nfqws.log'
    ];
}

function getDefaultSelectedVersion(): string {
    return NFQWS2_INSTALLED ? 'nfqws2' : 'nfqws';
}

function getSelectedVersion(): string {
    return $_SESSION['selected_version'] ?? getDefaultSelectedVersion();
}

function setSelectedVersion(string $version): void {
    $_SESSION['selected_version'] = $version;
}

function isInstalled(string $version): bool {
    return $version === 'nfqws2' ? NFQWS2_INSTALLED : NFQWS_INSTALLED;
}

function getServiceStatusByVersion(string $version): bool {
    $script = getScriptName($version);
    $path = ROOT_DIR . "/etc/init.d/" . $script;
    if (!file_exists($path)) {
        return false;
    }
    $output = null;
    exec($path . " status", $output);
    return str_contains($output[0] ?? '', 'is running');
}

function getActiveVersion(): string {
    if (getServiceStatusByVersion('nfqws2')) {
        return 'nfqws2';
    }
    if (getServiceStatusByVersion('nfqws')) {
        return 'nfqws';
    }
    return 'none';
}

// Функция для получения версии пакета nfqws/nfqws2
function getNfqwsVersion(string $version): string {
    $found = '';
    $pkg = $version === 'nfqws2' ? 'nfqws2-keenetic' : 'nfqws-keenetic';

    $opkg = null;
    if (file_exists('/opt/bin/opkg')) {
        $opkg = '/opt/bin/opkg';
    } elseif (file_exists('/usr/bin/opkg')) {
        $opkg = '/usr/bin/opkg';
    }

    if ($opkg) {
        $output = null;
        exec("{$opkg} status {$pkg} | awk -F': ' '/^Version:/ {print $2}'", $output);
        $found = $output[0] ?? '';
    }

    $apk = null;
    if (file_exists('/sbin/apk')) {
        $apk = '/sbin/apk';
    } elseif (file_exists('/usr/bin/apk')) {
        $apk = '/usr/bin/apk';
    } elseif (file_exists('/opt/sbin/apk')) {
        $apk = '/opt/sbin/apk';
    } elseif (file_exists('/opt/bin/apk')) {
        $apk = '/opt/bin/apk';
    }

    if (empty($found) && $apk) {
        $output = null;
        exec("{$apk} info {$pkg} 2>/dev/null | head -n 1", $output);
        if (!empty($output[0])) {
            if (preg_match('/' . preg_quote($pkg, '/') . '-([0-9][0-9a-zA-Z\.\-\+~]*)/', $output[0], $matches)) {
                $found = $matches[1] ?? '';
            }
        }
    }

    return $found ?: 'unknown';
}

function getVersionInfo(string $version): array {
    $ver = getNfqwsVersion($version);
    $installed = isInstalled($version);
    if (!$installed && $ver !== 'unknown') {
        $installed = true;
    }
    return [
        'version' => $ver,
        'installed' => $installed,
        'active' => getActiveVersion() === $version
    ];
}

function normalizeString(string $s): string {
    // Convert all line-endings to UNIX format.
    $s = str_replace(array("\r\n", "\r", "\n"), "\n", $s);

    // Don't allow out-of-control blank lines.
    $s = preg_replace("/\n{3,}/", "\n\n", $s);

    $lastChar = substr($s, -1);
    if ($lastChar !== "\n" && !empty($s)) {
        $s .= "\n";
    }

    return $s;
}

function getFiles(): array {
    $version = getSelectedVersion();
    $paths = getPaths($version);
    // GLOB_BRACE is unsupported in openwrt
    $basenames = [];

    if ($version === 'nfqws2') {
        $lists = array_filter(glob(ROOT_DIR . $paths['lists_dir'] . '/*'), function ($file) {
            return is_file($file) && preg_match('/\.(list|list-opkg|list-old)$/i', $file);
        });
        $basenames = array_map(fn($file) => basename($file), $lists);

        $confs = array_filter(glob(ROOT_DIR . $paths['conf_dir'] . '/*'), function ($file) {
            return is_file($file) && preg_match('/\.(conf|conf-opkg|conf-old|apk-new)$/i', $file);
        });
        $basenames = array_merge($basenames, array_map(fn($file) => basename($file), $confs));
    } else {
        $files = array_filter(glob(ROOT_DIR . $paths['conf_dir'] . '/*'), function ($file) {
            return is_file($file) && preg_match('/\.(list|list-opkg|list-old|conf|conf-opkg|conf-old|apk-new)$/i', $file);
        });
        $basenames = array_map(fn($file) => basename($file), $files);

        $extraListsDir = '/opt/etc/nfqws';
        if (is_dir($extraListsDir)) {
            $extraLists = array_filter(glob($extraListsDir . '/*.list'), function ($file) {
                return is_file($file);
            });
            $basenames = array_merge($basenames, array_map(fn($file) => basename($file), $extraLists));
        }
    }

    $logfile = ROOT_DIR . $paths['log_file'];
    if (file_exists($logfile)) {
        array_push($basenames, basename($logfile));
    }

    $basenames = array_values(array_unique($basenames));

    $priority = [
        'nfqws2.conf' => -7,
        'nfqws.conf' => -7,
        'user.list' => -6,
        'exclude.list' => -5,
        'auto.list' => -4,
        'ipset.list' => -3,
        'ipset_exclude.list' => -2,
        $paths['log_name'] => -1
    ];
    usort($basenames, fn($a, $b) => ($priority[$a] ?? 1) - ($priority[$b] ?? -1));

    return $basenames;
}

function getFileContent(string $filename): string {
    $version = getSelectedVersion();
    $paths = getPaths($version);
    $filename = basename($filename);
    if ($version === 'nfqws2' && preg_match('/\.(list|list-opkg|list-old)$/i', $filename)) {
        return file_get_contents(ROOT_DIR . $paths['lists_dir'] . '/' . $filename);
    }
    if ($version === 'nfqws' && preg_match('/\.(list|list-opkg|list-old)$/i', $filename)) {
        $extraListFile = '/opt/etc/nfqws/' . $filename;
        if (file_exists($extraListFile)) {
            return file_get_contents($extraListFile);
        }
    }
    return file_get_contents(ROOT_DIR . $paths['conf_dir'] . '/' . $filename);
}

function getLogContent(string $filename): string {
    $version = getSelectedVersion();
    $paths = getPaths($version);
    $file = file(ROOT_DIR . $paths['log_file']);
    $file = array_reverse($file);
    return implode("", $file);
}

function saveFile(string $filename, string $content) {
    $version = getSelectedVersion();
    $paths = getPaths($version);
    $filename = basename($filename);
    if (preg_match('/\.(log)$/i', $filename)) {
        $file = ROOT_DIR . $paths['log_file'];
    } elseif ($version === 'nfqws2' && preg_match('/\.(list|list-opkg|list-old)$/i', $filename)) {
        $file = ROOT_DIR . $paths['lists_dir'] . '/' . $filename;
    } elseif ($version === 'nfqws' && preg_match('/\.(list|list-opkg|list-old)$/i', $filename)) {
        $extraListFile = '/opt/etc/nfqws/' . $filename;
        if (file_exists($extraListFile)) {
            $file = $extraListFile;
        } else {
            $file = ROOT_DIR . $paths['conf_dir'] . '/' . $filename;
        }
    } else {
        $file = ROOT_DIR . $paths['conf_dir'] . '/' . $filename;
    }

    $protected = [
        $paths['primary_conf'],
        'user.list',
        'exclude.list',
        'auto.list',
        'ipset.list',
        'ipset_exclude.list',
        $paths['log_name']
    ];
    if (!file_exists($file) && in_array($filename, $protected, true)) {
        return false;
    }

    return file_put_contents($file, normalizeString($content)) !== false;
}

function saveLog(string $filename, string $content) {
    return saveFile($filename, $content);
}

function removeFile(string $filename) {
    $version = getSelectedVersion();
    $paths = getPaths($version);
    $filename = basename($filename);
    if ($version === 'nfqws2' && preg_match('/\.(list|list-opkg|list-old)$/i', $filename)) {
        $file = ROOT_DIR . $paths['lists_dir'] . '/' . $filename;
    } elseif ($version === 'nfqws' && preg_match('/\.(list|list-opkg|list-old)$/i', $filename)) {
        $extraListFile = '/opt/etc/nfqws/' . $filename;
        if (file_exists($extraListFile)) {
            $file = $extraListFile;
        } else {
            $file = ROOT_DIR . $paths['conf_dir'] . '/' . $filename;
        }
    } else {
        $file = ROOT_DIR . $paths['conf_dir'] . '/' . $filename;
    }
    $protected = [
        $paths['primary_conf'],
        'user.list',
        'exclude.list',
        'auto.list',
        'ipset.list',
        'ipset_exclude.list',
        $paths['log_name']
    ];
    if (in_array($filename, $protected, true)) {
        return false;
    }
    if (file_exists($file)) {
        return unlink($file);
    } else {
        return false;
    }
}

function nfqwsServiceStatus() {
    return getServiceStatusByVersion(getSelectedVersion());
}

function nfqwsServiceAction(string $action) {
    $output = null;
    $retval = null;
    $script = getScriptName(getSelectedVersion());
    exec(ROOT_DIR . "/etc/init.d/" . $script . " $action", $output, $retval);
    return array('output' => $output, 'status' => $retval);
}

function opkgUpgradeAction() {
    $output = null;
    $retval = null;
    $version = getSelectedVersion();
    if ($version === 'nfqws2') {
        exec("opkg update && opkg upgrade nfqws2-keenetic nfqws-keenetic-web", $output, $retval);
    } else {
        exec("opkg update && opkg upgrade nfqws-keenetic nfqws-keenetic-web", $output, $retval);
    }
    if (empty($output)) {
        $output[] = 'Nothing to update';
    }
    return array('output' => $output, 'status' => $retval);
}

function apkUpgradeAction() {
    $output = null;
    $retval = null;
    $version = getSelectedVersion();
    if ($version === 'nfqws2') {
        exec("apk --update-cache add nfqws2-keenetic nfqws-keenetic-web", $output, $retval);
    } else {
        exec("apk --update-cache add nfqws-keenetic nfqws-keenetic-web", $output, $retval);
    }
    if (empty($output)) {
        $output[] = 'Nothing to update';
    }
    return array('output' => $output, 'status' => $retval);
}

function upgradeAction() {
    return file_exists('/usr/bin/apk') ? apkUpgradeAction() : opkgUpgradeAction();
}

function selectVersion(string $target): array {
    if (!in_array($target, ['nfqws', 'nfqws2'], true)) {
        return array('status' => 1, 'output' => ['Invalid version']);
    }
    if (!isInstalled($target)) {
        return array('status' => 1, 'output' => ['Version not installed']);
    }
    setSelectedVersion($target);
    return array('status' => 0, 'selectedVersion' => $target, 'activeVersion' => getActiveVersion());
}

function switchVersion(string $target): array {
    if (!in_array($target, ['nfqws', 'nfqws2'], true)) {
        return array('status' => 1, 'output' => ['Invalid version']);
    }
    if (!isInstalled($target)) {
        return array('status' => 1, 'output' => ['Version not installed']);
    }

    $output = [];
    $retval = 0;
    $currentActive = getActiveVersion();

    if ($currentActive !== 'none' && $currentActive !== $target) {
        $currentScript = getScriptName($currentActive);
        exec(ROOT_DIR . "/etc/init.d/" . $currentScript . " stop", $output, $retval);
    }

    $targetScript = getScriptName($target);
    exec(ROOT_DIR . "/etc/init.d/" . $targetScript . " start", $output, $retval);

    setSelectedVersion($target);

    return array(
        'status' => $retval ?? 0,
        'output' => $output,
        'selectedVersion' => $target,
        'activeVersion' => getActiveVersion(),
        'service' => getServiceStatusByVersion($target)
    );
}

function authenticate($username, $password) {
    $passwdFile = ROOT_DIR . '/etc/passwd';
    $shadowFile = ROOT_DIR . '/etc/shadow';

    $users = file(file_exists($shadowFile) ? $shadowFile : $passwdFile);
    $user = preg_grep("/^$username/", $users);

    if ($user) {
        list(, $passwdInDB) = explode(':', array_pop($user));
        if (empty($passwdInDB)) {
            return empty($password);
        }
        if (crypt($password, $passwdInDB) == $passwdInDB) {
            return true;
        }
    }

    return false;
}

function main() {
    if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(302);
        header('Location: index.html');
        exit();
    }

    session_start();
    if (!isset($_SESSION['auth']) || !$_SESSION['auth']) {
        if ($_POST['cmd'] !== 'login' || !isset($_POST['user']) || !isset($_POST['password']) || !authenticate($_POST['user'], $_POST['password'])) {
            http_response_code(401);
            exit();
        } else {
            $_SESSION['auth'] = true;
        }
    }
    if (!isset($_SESSION['selected_version'])) {
        $_SESSION['selected_version'] = getDefaultSelectedVersion();
    }

    switch ($_POST['cmd']) {
        case 'filenames':
            $files = getFiles();
            $selectedVersion = getSelectedVersion();
            $response = array(
                'status' => 0,
                'files' => $files,
                'service' => nfqwsServiceStatus(),
                'nfqws2' => $selectedVersion === 'nfqws2',
                'version' => getNfqwsVersion($selectedVersion),
                'selectedVersion' => $selectedVersion,
                'activeVersion' => getActiveVersion(),
                'nfqwsInstalled' => NFQWS_INSTALLED,
                'nfqws2Installed' => NFQWS2_INSTALLED
            );
            break;

        case 'filecontent':
            if (str_ends_with($_POST['filename'], '.log')) {
                $content = getLogContent($_POST['filename']);
            } else {
                $content = getFileContent($_POST['filename']);
            }
            $response = array('status' => 0, 'content' => $content, 'filename' => $_POST['filename']);
            break;

        case 'filesave':
            if (str_ends_with($_POST['filename'], '.log')) {
                $result = saveLog($_POST['filename'], $_POST['content']);
            } else {
                $result = saveFile($_POST['filename'], $_POST['content']);
            }
            $response = array('status' => $result ? 0 : 1, 'filename' => $_POST['filename']);
            break;

        case 'fileremove':
            $result = removeFile($_POST['filename']);
            $response = array('status' => $result ? 0 : 1, 'filename' => $_POST['filename']);
            break;

        case 'reload':
        case 'restart':
        case 'stop':
        case 'start':
            $response = nfqwsServiceAction($_POST['cmd']);
            break;

        case 'upgrade':
            $response = upgradeAction();
            // После обновления получаем новую версию
            $response['version'] = getNfqwsVersion(getSelectedVersion());
            break;

        case 'login':
            $response = array('status' => 0);
            break;

        case 'logout':
            $_SESSION['auth'] = false;
            $response = array('status' => 0);
            break;

        case 'getversion':
            $targetVersion = $_POST['version'] ?? getSelectedVersion();
            if (!in_array($targetVersion, ['nfqws', 'nfqws2'], true)) {
                $targetVersion = getSelectedVersion();
            }
            $info = getVersionInfo($targetVersion);
            $response = array(
                'status' => 0,
                'version' => $info['version'],
                'installed' => $info['installed'],
                'active' => $info['active'],
                'nfqws2' => $targetVersion === 'nfqws2',
                'selectedVersion' => getSelectedVersion(),
                'activeVersion' => getActiveVersion()
            );
            break;
        case 'versions':
            $selectedVersion = getSelectedVersion();
            $response = array(
                'status' => 0,
                'selectedVersion' => $selectedVersion,
                'activeVersion' => getActiveVersion(),
                'nfqws' => getVersionInfo('nfqws'),
                'nfqws2' => getVersionInfo('nfqws2'),
                'nfqwsInstalled' => NFQWS_INSTALLED,
                'nfqws2Installed' => NFQWS2_INSTALLED
            );
            break;
        case 'select':
            $targetVersion = $_POST['version'] ?? '';
            $response = selectVersion($targetVersion);
            break;
        case 'switch':
            $targetVersion = $_POST['version'] ?? '';
            $response = switchVersion($targetVersion);
            break;

        default:
            http_response_code(405);
            exit();
    }

    header('Content-Type: application/json; charset=utf-8');
    http_response_code(200);
    echo json_encode($response);
    exit();
}

main();
