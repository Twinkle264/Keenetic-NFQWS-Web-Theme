// Синтаксис для nfqws.conf-opkg
CodeMirror.defineMode("nfqws-conf", function(config, parserConfig) {
    var indentUnit = config.indentUnit;
    var curPunc;

    function wordRegexp(words) {
        return new RegExp("^(?:" + words.join("|") + ")$", "i");
    }
    
    var ops = wordRegexp(["iptables", "ip", "tc", "route", "sysctl", "echo"]);
    var keywords = wordRegexp([
        "start", "stop", "restart", "reload", "enable", "disable",
        "config", "option", "list", "log", "debug", "verbose",
        "iface", "proto", "port", "ip", "mask", "gateway",
        "dns", "domain", "server", "client", "network", "host",
        "path", "file", "dir", "user", "group", "perm",
        "yes", "no", "true", "false", "on", "off"
    ]);
    
    var builtin = wordRegexp([
        "ROOT", "BIN", "SBIN", "ETC", "VAR", "LOG", "TMP",
        "PID", "LOCK", "RUN", "SYS", "PROC", "DEV", "OPT"
    ]);

    var isOperatorChar = /[+\-*&%=<>!?|]/;

    function chain(stream, state, f) {
        state.tokenize = f;
        return f(stream, state);
    }

    function tokenBase(stream, state) {
        var ch = stream.next();
        
        if (ch == "#") {
            stream.skipToEnd();
            return "comment";
        }
        
        if (ch == '"' || ch == "'") {
            return chain(stream, state, tokenString(ch));
        }
        
        if (ch == "$" && stream.eat("{")) {
            return chain(stream, state, tokenVariable);
        }
        
        if (/[\d\.]/.test(ch)) {
            if (ch == "." && stream.eat(".")) {
                return "operator";
            }
            stream.eatWhile(/[\w\.]/);
            return "number";
        }
        
        if (ch == "/" && stream.eat("*")) {
            return chain(stream, state, tokenComment);
        }
        
        if (isOperatorChar.test(ch)) {
            stream.eatWhile(isOperatorChar);
            return "operator";
        }
        
        stream.eatWhile(/[\w\$_]/);
        var cur = stream.current();
        
        if (keywords.test(cur)) return "keyword";
        if (ops.test(cur)) return "builtin";
        if (builtin.test(cur)) return "variable-2";
        
        return "variable";
    }

    function tokenString(quote) {
        return function(stream, state) {
            var escaped = false, next, end = false;
            while ((next = stream.next()) != null) {
                if (next == quote && !escaped) {
                    end = true;
                    break;
                }
                escaped = !escaped && next == "\\";
            }
            if (end || !escaped) state.tokenize = tokenBase;
            return "string";
        };
    }

    function tokenComment(stream, state) {
        var maybeEnd = false, ch;
        while (ch = stream.next()) {
            if (ch == "/" && maybeEnd) {
                state.tokenize = tokenBase;
                break;
            }
            maybeEnd = (ch == "*");
        }
        return "comment";
    }

    function tokenVariable(stream, state) {
        stream.eatWhile(/[\w_]/);
        if (stream.eat("}")) {
            state.tokenize = tokenBase;
        }
        return "variable-2";
    }

    return {
        startState: function() {
            return {
                tokenize: tokenBase,
                startOfLine: true
            };
        },
        token: function(stream, state) {
            if (stream.eatSpace()) return null;
            var style = state.tokenize(stream, state);
            return style;
        },
        lineComment: "#",
        fold: "indent"
    };
});

// Синтаксис для лог файлов
CodeMirror.defineMode("nfqws-log", function(config, parserConfig) {
    var indentUnit = config.indentUnit;
    
    function wordRegexp(words) {
        return new RegExp("^(?:" + words.join("|") + ")$", "i");
    }
    
    var logLevels = wordRegexp([
        "ERROR", "WARN", "WARNING", "INFO", "DEBUG", "TRACE",
        "FATAL", "CRITICAL", "SEVERE", "NOTICE"
    ]);
    
    var logKeywords = wordRegexp([
        "started", "stopped", "restarted", "failed", "success",
        "connection", "packet", "rule", "match", "drop", "accept",
        "forward", "queue", "process", "thread", "memory", "cpu",
        "timeout", "retry", "attempt", "session", "client", "server"
    ]);

    function tokenBase(stream, state) {
        var ch = stream.next();
        
        // Временные метки
        if (/[\d:]/.test(ch)) {
            stream.eatWhile(/[\d\-:\.TZ]/);
            var current = stream.current();
            if (current.match(/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/) ||
                current.match(/^\d{2}:\d{2}:\d{2}/)) {
                return "atom";
            }
        }
        
        // IP адреса
        if (ch.match(/[\d\.]/)) {
            stream.eatWhile(/[\d\.:]/);
            var ip = stream.current();
            if (ip.match(/^\d+\.\d+\.\d+\.\d+(:\d+)?$/)) {
                return "number";
            }
        }
        
        // Уровни логирования
        stream.eatWhile(/[\w\-\_]/);
        var cur = stream.current();
        
        if (logLevels.test(cur)) {
            if (cur === "ERROR" || cur === "FATAL" || cur === "CRITICAL") {
                return "error";
            } else if (cur === "WARN" || cur === "WARNING") {
                return "warning";
            } else if (cur === "INFO" || cur === "NOTICE") {
                return "info";
            } else if (cur === "DEBUG" || cur === "TRACE") {
                return "comment";
            }
            return "tag";
        }
        
        if (logKeywords.test(cur)) return "keyword";
        
        // Квадратные скобки для модулей/компонентов
        if (ch == "[") {
            stream.skipTo("]");
            stream.next();
            return "bracket";
        }
        
        // Цифры
        if (ch.match(/\d/)) {
            stream.eatWhile(/\d/);
            return "number";
        }
        
        return null;
    }

    return {
        startState: function() {
            return {
                tokenize: tokenBase,
                startOfLine: true
            };
        },
        token: function(stream, state) {
            if (stream.eatSpace()) return null;
            var style = state.tokenize(stream, state);
            return style;
        },
        lineComment: null,
        fold: "indent"
    };
});

// Регистрация режимов
CodeMirror.modeExtensions["nfqws-conf"] = {};
CodeMirror.modeExtensions["nfqws-log"] = {};

// Добавление в существующий режим shell
CodeMirror.defineMIME("text/x-nfqws-conf", "nfqws-conf");
CodeMirror.defineMIME("text/x-nfqws-log", "nfqws-log");