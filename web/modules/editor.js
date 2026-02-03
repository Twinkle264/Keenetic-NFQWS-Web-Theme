import { CLASSNAMES } from './constants.js';

export function applyEditor(UI) {
    Object.assign(UI.prototype, {
        // === Editor ===
        initCodeMirror() {
            const textarea = this.dom.config;
            this.editor = this.createCodeMirrorEditor(textarea, {
                mode: 'shell',
                autofocus: false,
                placeholder: this.translations.placeholder,
                readOnly: !this.isAuthenticated,
                extraKeys: {
                    "Ctrl-S": (cm) => {
                        this.saveCurrentFile();
                        return false; // Предотвращаем стандартное поведение
                    },
                    "Cmd-S": (cm) => {
                        this.saveCurrentFile();
                        return false; // Предотвращаем стандартное поведение
                    },
                    "Ctrl-Z": (cm) => {
                        // Позволяем CodeMirror обработать отмену самостоятельно
                        return CodeMirror.Pass;
                    },
                    "Cmd-Z": (cm) => {
                        // Позволяем CodeMirror обработать отмену самостоятельно
                        return CodeMirror.Pass;
                    },
                    "Ctrl-Y": (cm) => {
                        // Позволяем CodeMirror обработать повтор самостоятельно
                        return CodeMirror.Pass;
                    },
                    "Cmd-Y": (cm) => {
                        // Позволяем CodeMirror обработать повтор самостоятельно
                        return CodeMirror.Pass;
                    },
                    "Ctrl-Shift-Z": (cm) => {
                        // Позволяем CodeMirror обработать повтор самостоятельно
                        return CodeMirror.Pass;
                    },
                    "Cmd-Shift-Z": (cm) => {
                        // Позволяем CodeMirror обработать повтор самостоятельно
                        return CodeMirror.Pass;
                    }
                }
            });

            this.editor.on('change', () => {
                this.checkForChanges();
                this.scheduleListDuplicateUpdate();
            });
            
            // Фокус на редакторе для работы горячих клавиш
            this.editor.on('focus', () => {
                document.activeEditor = this.editor;
            });
        },

        checkForChanges() {
            if (!this.isAuthenticated) return;
            
            const currentContent = this.editor.getValue();
            const hasChanges = currentContent !== this.originalContent;
            document.body.classList.toggle(CLASSNAMES.changed, hasChanges);
            
            const saveButton = this.dom.save;
            const saveFsButton = this.dom.saveFullscreen;
            
            if (hasChanges) {
                saveButton.style.display = 'inline-flex';
                saveFsButton.style.display = 'inline-flex';
            } else {
                saveButton.style.display = 'none';
                
                const editorContainer = this.dom.editorContainer;
                if (editorContainer && !editorContainer.classList.contains(CLASSNAMES.fullscreen)) {
                    saveFsButton.style.display = 'none';
                }
            }
        },

        clearChangedState() {
            document.body.classList.remove(CLASSNAMES.changed);
        },

        markEditorClean(content) {
            if (!this.editor) return;
            const nextContent = content !== undefined ? content : this.editor.getValue();
            this.originalContent = nextContent;
            this.clearChangedState();
        },

        setEditorContent(content, filename, { setReadOnly = false } = {}) {
            if (!this.editor) return;
            this.editor.setValue(content);
            this.originalContent = content;
            if (filename) {
                this.setEditorModeForFile(filename);
                if (setReadOnly) {
                    this.editor.setOption('readOnly', this.isLogFile(filename));
                }
            }
            this.clearChangedState();
        },

        async safeGetFileContent(filename, { onErrorMessage } = {}) {
            try {
                return await this.getFileContent(filename);
            } catch (error) {
                console.error('Error loading file:', filename, error);
                if (onErrorMessage) {
                    this.showError(`${this.translations.error}: ${onErrorMessage}`);
                }
                return null;
            }
        },

        async saveFileAndNotify(filename, content, { successMessage, errorMessage }) {
            const result = await this.saveFile(filename, content);
            if (result && !result.status) {
                if (successMessage) {
                    this.showSuccess(successMessage);
                }
                return true;
            }
            if (errorMessage) {
                this.showError(`${this.translations.error}: ${errorMessage}`);
            }
            return false;
        },

        async saveFileQuiet(filename, content) {
            const result = await this.saveFile(filename, content);
            return Boolean(result && !result.status);
        },

        toggleFullscreen() {
            const editorContainer = this.dom.editorContainer;
            const fsButton = this.dom.editorFullscreen;
            
            if (editorContainer && editorContainer.classList.contains(CLASSNAMES.fullscreen)) {
                // Плавное закрытие
                editorContainer.classList.add(CLASSNAMES.closing);
                fsButton.title = this.translations.fullscreen;
                
                setTimeout(() => {
                    editorContainer.classList.remove(CLASSNAMES.fullscreen, CLASSNAMES.closing);
                    document.body.classList.remove(CLASSNAMES.fullscreenActive);
                    
                    // Восстанавливаем стандартную иконку
                    fsButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>';
                    
                    // Скрываем кнопку Save в normal режиме
                    const saveFsButton = this.dom.saveFullscreen;
                    if (!document.body.classList.contains(CLASSNAMES.changed)) {
                        saveFsButton.style.display = 'none';
                    }
                }, 500);
            } else {
                // Плавное открытие
                if (editorContainer) editorContainer.classList.add(CLASSNAMES.fullscreen);
                document.body.classList.add(CLASSNAMES.fullscreenActive);
                fsButton.title = this.translations.exitFullscreen;
                
                // Меняем иконку на "выход из fullscreen"
                fsButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>';
                
                // Показываем кнопку Save в fullscreen
                const saveFsButton = this.dom.saveFullscreen;
                saveFsButton.style.display = 'inline-flex';
            }
            
            if (this.editor) {
                setTimeout(() => {
                    this.editor.refresh();
                    this.editor.focus();
                }, 100);
            }
        },

        createCodeMirrorEditor(textarea, options = {}) {
            return CodeMirror.fromTextArea(textarea, {
                lineNumbers: true,
                theme: this.getCurrentCodeMirrorTheme(),
                lineWrapping: true,
                ...options
            });
        },

        // === Syntax ===
        setEditorModeForFile(filename) {
            const isConfigFile = this.isConfigFile(filename);
            const isLogFile = this.isLogFile(filename);

            if (this.syntaxMode === 'shell') {
                if (isConfigFile) {
                    this.editor.setOption('mode', 'shell');
                } else {
                    this.editor.setOption('mode', 'text/plain');
                }
                return;
            }

            if (isLogFile) {
                this.editor.setOption('mode', 'text/x-nfqws-log');
            } else if (isConfigFile) {
                this.editor.setOption('mode', 'text/x-nfqws-conf');
            } else {
                this.editor.setOption('mode', 'text/plain');
            }
        },

        updateSyntaxToggleUI() {
            const syntaxText = this.dom.syntaxText;
            if (!syntaxText) return;
            syntaxText.textContent = this.syntaxMode === 'nfqws'
                ? (this.translations.syntaxCustom || 'NFQWS')
                : (this.translations.syntaxShell || 'Shell');
        }
    });
}
