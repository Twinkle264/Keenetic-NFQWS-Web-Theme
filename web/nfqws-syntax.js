// Синтаксис для nfqws.conf-opkg
CodeMirror.defineMode("nfqws-conf", function(config, parserConfig) {
    var indentUnit = config.indentUnit;
    var curPunc;

    function wordRegexp(words) {
        return new RegExp("^(?:" + words.join("|") + ")$", "i");
    }
    
    var ops = wordRegexp(["iptables", "ip", "tc", "route", "sysctl", "echo"]);
    var coreKeys = wordRegexp([
        "ISP_INTERFACE",
        "NFQWS_ARGS",
        "NFQWS_ARGS_CUSTOM",
        "NFQWS_ARGS_QUIC",
        "NFQWS_ARGS_UDP",
        "MODE_LIST",
        "MODE_ALL",
        "MODE_AUTO",
        "NFQWS_EXTRA_ARGS",
        "NFQWS_ARGS_IPSET",
        "IPV6_ENABLED",
        "TCP_PORTS",
        "UDP_PORTS",
        "POLICY_NAME",
        "POLICY_EXCLUDE",
        "LOG_LEVEL",
        "NFQUEUE_NUM",
        "USER",
        "CONFIG_VERSION"
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
        if (state.lineIsUnquoted) {
            stream.skipToEnd();
            return "error";
        }

        if (state.afterClosingQuote) {
            stream.skipToEnd();
            return "error";
        }

        var ch = stream.next();
        if (state.pendingCore && ch != '"' && ch != '=') {
            state.pendingCore = false;
        }
        
        if (ch == "#") {
            stream.skipToEnd();
            return "comment";
        }

        if (ch == "\\" && stream.eol()) {
            return "operator";
        }
        
        if (ch == '"' || ch == "'") {
            if (state.pendingCore && ch == '"') {
                state.pendingCore = false;
                state.coreBlockOpen = true;
                state.coreBlockClosed = false;
                if (stream.peek() == '"') {
                    stream.next();
                    state.coreBlockOpen = false;
                    state.coreBlockClosed = true;
                    var rest = stream.string.slice(stream.pos);
                    if (/\S/.test(rest)) state.afterClosingQuote = true;
                }
                return "string";
            }

            if (state.coreBlockOpen && ch == '"') {
                state.coreBlockOpen = false;
                state.coreBlockClosed = true;
                var restAfter = stream.string.slice(stream.pos);
                if (/\S/.test(restAfter)) state.afterClosingQuote = true;
                return "string";
            }

            return chain(stream, state, tokenString(ch));
        }

        if (ch == "=") {
            return "operator";
        }
        
        if (ch == "$" && stream.eat("{")) {
            return chain(stream, state, tokenVariable);
        }
        
        if (/\d/.test(ch)) {
            stream.eatWhile(/[A-Za-z0-9,:._-]/);
            var num = stream.current();
            if (/^0x[0-9a-fA-F]+$/.test(num)) return "number";
            if (/^\d+(?:[,:-]\d+)*$/.test(num)) return "number";
            return "variable";
        }

        if (ch == "." && stream.eat(".")) {
            return "operator";
        }
        
        if (ch == "/" && stream.eat("*")) {
            return chain(stream, state, tokenComment);
        }

        if (ch == "/" && stream.peek() && /[\w\-\.\/]/.test(stream.peek())) {
            stream.eatWhile(/[\w\-\.\/]/);
            return "string-2";
        }
        
        if (ch == "-" && stream.peek() == "-") {
            stream.eatWhile(/[\w\-\:]+/);
            var flag = stream.current();
            if (flag === "--new") {
                return "nfqws-new";
            }
            if (flag === "--filter-udp" || flag === "--filter-tcp") {
                return "nfqws-filter";
            }
            return "keyword";
        }

        if (isOperatorChar.test(ch)) {
            stream.eatWhile(isOperatorChar);
            return "operator";
        }

        if (/[A-Za-z_]/.test(ch)) {
            stream.eatWhile(/[\w_]/);
            var name = stream.current();
            if (stream.peek() == "=") {
                if (coreKeys.test(name)) {
                    state.pendingCore = true;
                    state.coreBlockClosed = false;
                    state.unquotedBlock = false;
                    return "def";
                }
                return "variable-2";
            }
        }
        
        stream.eatWhile(/[\w\$_]/);
        var cur = stream.current();
        
        if (ops.test(cur)) return "builtin";
        if (coreKeys.test(cur)) return "def";
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
                startOfLine: true,
                pendingCore: false,
                afterClosingQuote: false,
                unquotedBlock: false,
                lineIsUnquoted: false,
                coreBlockOpen: false,
                coreBlockClosed: false
                };
            },
        token: function(stream, state) {
            if (stream.sol()) {
                state.afterClosingQuote = false;
                state.lineIsUnquoted = false;
                var trimmed = stream.string.trim();
                if (state.coreBlockOpen && trimmed === '"') {
                    state.coreBlockOpen = false;
                    state.coreBlockClosed = true;
                }
                var match = trimmed.match(/^([A-Za-z_][\w_]*)=/);
                if (match && coreKeys.test(match[1])) {
                    state.coreBlockClosed = false;
                }
                if (state.unquotedBlock && trimmed.startsWith("--")) {
                    state.lineIsUnquoted = true;
                }
                if (state.coreBlockClosed && trimmed && trimmed !== '"' && !trimmed.startsWith("#")) {
                    state.lineIsUnquoted = true;
                }
                if (trimmed === "" || trimmed.startsWith("#")) {
                    state.unquotedBlock = false;
                }
            }
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
