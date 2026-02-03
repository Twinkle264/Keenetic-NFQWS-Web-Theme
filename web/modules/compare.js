import { CLASSNAMES } from './constants.js';

export function applyCompare(UI) {
    Object.assign(UI.prototype, {
        initComparePopup() {
            const popup = this.dom.comparePopup;
            const closeDesktop = this.dom.compareCloseDesktop;
            const closeMobile = this.dom.compareCloseMobile;
            const saveRightDesktop = this.dom.compareSaveRightDesktop;
            const saveMobile = this.dom.compareSaveMobile;
            if (!popup || !closeDesktop) return;
            const panelsDesktop = popup.querySelector('.compare-panels-desktop');
            const panelsMobile = popup.querySelector('.compare-panels-mobile');
            const close = () => {
                popup.classList.add(CLASSNAMES.hidden);
                const duplicatesPopup = this.dom.duplicatesPopup;
                if (duplicatesPopup) {
                    duplicatesPopup.classList.remove(CLASSNAMES.hidden);
                }
                this.checkListDuplicates();
            };
            popup.addEventListener('click', (event) => {
                if (event.target === popup ||
                    (panelsDesktop && event.target === panelsDesktop) ||
                    (panelsMobile && event.target === panelsMobile)) {
                    close();
                }
            });
            closeDesktop.addEventListener('click', close);
            if (closeMobile) closeMobile.addEventListener('click', close);
            if (saveRightDesktop) {
                saveRightDesktop.addEventListener('click', async () => {
                    await this.saveCompareBoth();
                });
            }
            if (saveMobile) {
                saveMobile.addEventListener('click', async () => {
                    await this.saveCompareBoth();
                });
            }

            const leftNameMobile = this.dom.compareLeftNameMobile;
            const rightNameMobile = this.dom.compareRightNameMobile;
            if (leftNameMobile && rightNameMobile) {
                leftNameMobile.addEventListener('click', () => this.setCompareMobileSide('left'));
                rightNameMobile.addEventListener('click', () => this.setCompareMobileSide('right'));
            }

            if (window.matchMedia) {
                const mq = window.matchMedia('(max-width: 900px)');
                mq.addEventListener('change', () => this.syncComparePanels());
            }
        },

        async openComparePopup(compareFile, compareLine = 1, currentLine = 1) {
            const comparePopup = this.dom.comparePopup;
            const duplicatesPopup = this.dom.duplicatesPopup;
            const leftNameDesktop = this.dom.compareLeftNameDesktop;
            const rightNameDesktop = this.dom.compareRightNameDesktop;
            const leftNameMobile = this.dom.compareLeftNameMobile;
            const rightNameMobile = this.dom.compareRightNameMobile;
            const leftContentDesktop = this.dom.compareLeftContentDesktop;
            const rightContentDesktop = this.dom.compareRightContentDesktop;
            const contentMobile = this.dom.compareContentMobile;

            if (!comparePopup || !leftContentDesktop || !rightContentDesktop || !contentMobile) return;

            if (duplicatesPopup) {
                duplicatesPopup.classList.add(CLASSNAMES.hidden);
            }

            const currentName = this.currentFilename || '';
            this.compareLeftFilename = currentName;
            this.compareRightFilename = compareFile;
            this.compareTargetLines = {
                left: Math.max(1, currentLine),
                right: Math.max(1, compareLine)
            };
            this.setCompareNames({
                leftNameDesktop,
                rightNameDesktop,
                leftNameMobile,
                rightNameMobile,
                currentName,
                compareFile
            });
            const leftValue = this.editor ? this.editor.getValue() : '';
            const rightValue = '';
            this.compareBuffers = {
                left: leftValue,
                right: rightValue
            };
            this.compareActiveSideMobile = 'left';

            this.initCompareEditors({
                leftContentDesktop,
                rightContentDesktop,
                contentMobile,
                currentName,
                compareFile,
                leftValue,
                rightValue
            });

            try {
                const content = await this.safeGetFileContent(compareFile, {
                    onErrorMessage: this.translations.failedToLoadFile
                });
                if (content === null) return;
                const rightContentValue = content || '';
                this.compareDesktopRightEditor.setValue(rightContentValue);
                this.compareBuffers.right = rightContentValue;
            } catch (error) {
                this.compareDesktopRightEditor.setValue('');
                this.showError(`${this.translations.error}: ${this.translations.failedToLoadFile}`);
            }

            comparePopup.classList.remove(CLASSNAMES.hidden);
            this.refreshCompareEditors();
            this.setCompareMobileSide('left');
            this.syncComparePanels();
            setTimeout(() => {
                this.refreshCompareEditors();
                this.scrollCompareToLines(this.compareTargetLines);
                this.applyCompareHighlight(this.compareTargetLines);
            }, 0);
        },

        setCompareNames({ leftNameDesktop, rightNameDesktop, leftNameMobile, rightNameMobile, currentName, compareFile }) {
            if (leftNameDesktop) leftNameDesktop.textContent = currentName || '';
            if (rightNameDesktop) rightNameDesktop.textContent = compareFile;
            if (leftNameMobile) leftNameMobile.textContent = currentName || '';
            if (rightNameMobile) rightNameMobile.textContent = compareFile;
        },

        initCompareEditors({ leftContentDesktop, rightContentDesktop, contentMobile, currentName, compareFile, leftValue, rightValue }) {
            if (!this.compareDesktopLeftEditor) {
                this.compareDesktopLeftEditor = this.createCompareEditor(leftContentDesktop);
            }

            if (!this.compareDesktopRightEditor) {
                this.compareDesktopRightEditor = this.createCompareEditor(rightContentDesktop);
            }

            if (!this.compareMobileEditor) {
                this.compareMobileEditor = this.createCompareEditor(contentMobile);
            }

            this.compareDesktopLeftEditor.setValue(leftValue);
            this.compareDesktopRightEditor.setValue(rightValue);
            this.compareMobileEditor.setValue(leftValue);
            this.setCompareEditorMode(this.compareDesktopLeftEditor, currentName);
            this.setCompareEditorMode(this.compareDesktopRightEditor, compareFile);
            this.setCompareEditorMode(this.compareMobileEditor, currentName);
        },

        createCompareEditor(textarea) {
            return this.createCodeMirrorEditor(textarea, {
                mode: 'text/plain',
                readOnly: false
            });
        },

        isCompareMobile() {
            return window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
        },

        syncComparePanels() {
            if (!this.compareDesktopLeftEditor || !this.compareDesktopRightEditor || !this.compareMobileEditor) return;
            if (this.isCompareMobile()) {
                this.updateCompareBuffersFromDesktop();
                this.setCompareMobileSide(this.compareActiveSideMobile || 'left');
            } else {
                this.updateCompareBuffersFromMobile();
                this.applyCompareBuffersToDesktopEditors();
            }
            if (this.compareTargetLines) {
                this.applyCompareHighlight(this.compareTargetLines);
            }
        },

        setCompareMobileSide(side) {
            if (!this.compareMobileEditor || !this.compareBuffers) return;
            if (this.compareActiveSideMobile) {
                this.compareBuffers[this.compareActiveSideMobile] = this.compareMobileEditor.getValue();
            }
            this.compareActiveSideMobile = side;
            this.compareMobileEditor.setValue(this.compareBuffers[side] || '');
            const filename = side === 'right' ? this.compareRightFilename : this.compareLeftFilename;
            if (filename) {
                this.setCompareEditorMode(this.compareMobileEditor, filename);
            }
            this.refreshCompareEditors();
            if (this.isCompareMobile() && this.compareTargetLines) {
                this.scrollCompareToLines(this.compareTargetLines);
            }
            if (this.compareTargetLines) {
                this.applyCompareHighlight(this.compareTargetLines);
            }

            const leftName = this.dom.compareLeftNameMobile;
            const rightName = this.dom.compareRightNameMobile;
            if (leftName) leftName.classList.toggle(CLASSNAMES.active, side === 'left');
            if (rightName) rightName.classList.toggle(CLASSNAMES.active, side === 'right');
        },

        async saveCompareFile(filename, content) {
            if (!this.isAuthenticated) return;
            const saved = await this.saveFileAndNotify(filename, content, {
                successMessage: this.translations.fileSaved || 'Saved',
                errorMessage: this.translations.failedToSaveFile
            });
            if (saved) {
                this.applySavedCompareContent(filename, content);
            }
        },

        applySavedCompareContent(filename, content) {
            if (filename === this.currentFilename && this.editor) {
                this.setEditorContent(content, this.currentFilename);
            }
            if (this.compareLeftFilename === filename) {
                if (this.compareBuffers) this.compareBuffers.left = content;
                if (this.compareDesktopLeftEditor) this.compareDesktopLeftEditor.setValue(content);
                if (this.compareMobileEditor && this.compareActiveSideMobile === 'left') {
                    this.compareMobileEditor.setValue(content);
                }
            }
            if (this.compareRightFilename === filename) {
                if (this.compareBuffers) this.compareBuffers.right = content;
                if (this.compareDesktopRightEditor) this.compareDesktopRightEditor.setValue(content);
                if (this.compareMobileEditor && this.compareActiveSideMobile === 'right') {
                    this.compareMobileEditor.setValue(content);
                }
            }
        },

        async saveCompareBoth() {
            if (!this.isAuthenticated) return;
            if (!this.compareLeftFilename || !this.compareRightFilename) return;

            if (!this.isCompareMobile()) {
                this.updateCompareBuffersFromDesktop();
            } else if (this.compareMobileEditor && this.compareActiveSideMobile) {
                this.updateCompareBuffersFromMobile();
            }

            const leftContent = this.compareBuffers?.left ?? '';
            const rightContent = this.compareBuffers?.right ?? '';

            const leftSaved = await this.saveFileQuiet(this.compareLeftFilename, leftContent);
            const rightSaved = await this.saveFileQuiet(this.compareRightFilename, rightContent);

            if (leftSaved && rightSaved) {
                this.applySavedCompareContent(this.compareLeftFilename, leftContent);
                this.applySavedCompareContent(this.compareRightFilename, rightContent);
                this.showSuccess(this.translations.fileSaved || 'Saved');
            } else {
                this.showError(`${this.translations.error}: ${this.translations.failedToSaveFile}`);
            }
        },

        setCompareEditorMode(editor, filename) {
            if (!editor) return;
            const isConfigFile = this.isConfigFile(filename);
            const isLogFile = this.isLogFile(filename);
            if (this.syntaxMode === 'shell') {
                if (isConfigFile) {
                    editor.setOption('mode', 'shell');
                } else {
                    editor.setOption('mode', 'text/plain');
                }
                return;
            }
            if (isLogFile) {
                editor.setOption('mode', 'text/x-nfqws-log');
            } else if (isConfigFile) {
                editor.setOption('mode', 'text/x-nfqws-config');
            } else {
                editor.setOption('mode', 'text/plain');
            }
        },

        updateCompareBuffersFromDesktop() {
            if (!this.compareDesktopLeftEditor || !this.compareDesktopRightEditor || !this.compareBuffers) return;
            this.compareBuffers.left = this.compareDesktopLeftEditor.getValue();
            this.compareBuffers.right = this.compareDesktopRightEditor.getValue();
        },

        updateCompareBuffersFromMobile() {
            if (!this.compareMobileEditor || !this.compareBuffers) return;
            const side = this.compareActiveSideMobile || 'left';
            this.compareBuffers[side] = this.compareMobileEditor.getValue();
        },

        applyCompareBuffersToDesktopEditors() {
            if (!this.compareDesktopLeftEditor || !this.compareDesktopRightEditor || !this.compareBuffers) return;
            this.compareDesktopLeftEditor.setValue(this.compareBuffers.left || '');
            this.compareDesktopRightEditor.setValue(this.compareBuffers.right || '');
            this.refreshCompareEditors();
        },

        refreshCompareEditors() {
            if (this.compareDesktopLeftEditor) this.compareDesktopLeftEditor.refresh();
            if (this.compareDesktopRightEditor) this.compareDesktopRightEditor.refresh();
            if (this.compareMobileEditor) this.compareMobileEditor.refresh();
        },

        clearCompareHighlights() {
            if (this.compareHighlightHandles?.left && this.compareDesktopLeftEditor) {
                this.compareDesktopLeftEditor.removeLineClass(this.compareHighlightHandles.left, 'background', 'compare-highlight-line');
            }
            if (this.compareHighlightHandles?.right && this.compareDesktopRightEditor) {
                this.compareDesktopRightEditor.removeLineClass(this.compareHighlightHandles.right, 'background', 'compare-highlight-line');
            }
            if (this.compareHighlightHandles?.mobile && this.compareMobileEditor) {
                this.compareMobileEditor.removeLineClass(this.compareHighlightHandles.mobile, 'background', 'compare-highlight-line');
            }
            this.compareHighlightHandles = { left: null, right: null, mobile: null };
        },

        applyCompareHighlight(targetLines) {
            const leftLine = targetLines?.left;
            const rightLine = targetLines?.right;
            this.clearCompareHighlights();
            if (this.isCompareMobile()) {
                const side = this.compareActiveSideMobile || 'left';
                const lineNumber = side === 'right' ? rightLine : leftLine;
                if (!lineNumber || lineNumber < 1) return;
                const line = Math.max(0, lineNumber - 1);
                if (this.compareMobileEditor) {
                    const handle = this.compareMobileEditor.getLineHandle(line);
                    if (handle) {
                        this.compareMobileEditor.addLineClass(handle, 'background', 'compare-highlight-line');
                        this.compareHighlightHandles.mobile = handle;
                    }
                }
                return;
            }
            if (this.compareDesktopLeftEditor && leftLine && leftLine >= 1) {
                const handle = this.compareDesktopLeftEditor.getLineHandle(leftLine - 1);
                if (handle) {
                    this.compareDesktopLeftEditor.addLineClass(handle, 'background', 'compare-highlight-line');
                    this.compareHighlightHandles.left = handle;
                }
            }
            if (this.compareDesktopRightEditor && rightLine && rightLine >= 1) {
                const handle = this.compareDesktopRightEditor.getLineHandle(rightLine - 1);
                if (handle) {
                    this.compareDesktopRightEditor.addLineClass(handle, 'background', 'compare-highlight-line');
                    this.compareHighlightHandles.right = handle;
                }
            }
        },

        scrollCompareToLines(targetLines) {
            const leftLine = targetLines?.left;
            const rightLine = targetLines?.right;
            if (!this.compareDesktopLeftEditor || !this.compareDesktopRightEditor || !this.compareMobileEditor) return;

            if (this.isCompareMobile()) {
                const side = this.compareActiveSideMobile || 'left';
                const lineNumber = side === 'right' ? rightLine : leftLine;
                if (!lineNumber || lineNumber < 1) return;
                const line = Math.max(0, lineNumber - 1);
                this.compareMobileEditor.scrollIntoView({ line, ch: 0 }, 80);
            } else {
                if (leftLine && leftLine >= 1) {
                    this.compareDesktopLeftEditor.scrollIntoView({ line: leftLine - 1, ch: 0 }, 80);
                }
                if (rightLine && rightLine >= 1) {
                    this.compareDesktopRightEditor.scrollIntoView({ line: rightLine - 1, ch: 0 }, 80);
                }
            }
        }
    });
}
