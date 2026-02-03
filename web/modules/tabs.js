import { CLASSNAMES, STORAGE_KEYS } from './constants.js';

export function applyTabs(UI) {
    Object.assign(UI.prototype, {
        initTabs() {
            const tabs = {};
            let currentFile = '';
            const supportsPointer = 'PointerEvent' in window;
            let dragState = null;

            const createTabElement = (filename) => {
                const tab = document.createElement('div');
                tab.classList.add('nav-tab');
                tab.dataset.filename = filename;
                tab.dataset.dragMoved = '0';
                tab.textContent = filename;
                return tab;
            };

            const createClearButton = (filename) => {
                const clear = document.createElement('div');
                clear.classList.add('nav-clear');
                clear.innerHTML = '<svg width="12" height="12" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M 28.28125 2.28125 L 18.28125 12.28125 L 17 11 L 17 10.96875 L 16.96875 10.9375 C 16.328125 10.367188 15.492188 10.09375 14.6875 10.09375 C 13.882813 10.09375 13.105469 10.394531 12.5 11 L 12.34375 11.125 L 11.84375 11.625 L 11.5 11.90625 L 2.375 19 L 1.5 19.71875 L 12.28125 30.5 L 13 29.625 L 20.0625 20.5625 L 20.09375 20.59375 L 21.09375 19.59375 L 21.125 19.59375 L 21.15625 19.5625 C 22.296875 18.277344 22.304688 16.304688 21.09375 15.09375 L 19.71875 13.71875 L 29.71875 3.71875 Z M 14.6875 12.09375 C 14.996094 12.085938 15.335938 12.191406 15.59375 12.40625 C 15.605469 12.414063 15.613281 12.429688 15.625 12.4375 L 19.6875 16.5 C 20.0625 16.875 20.097656 17.671875 19.6875 18.1875 C 19.671875 18.207031 19.671875 18.230469 19.65625 18.25 L 19.34375 18.53125 L 13.5625 12.75 L 13.90625 12.40625 C 14.097656 12.214844 14.378906 12.101563 14.6875 12.09375 Z M 12.03125 14.03125 L 17.96875 19.96875 L 12.09375 27.46875 L 10.65625 26.03125 L 12.8125 23.78125 L 11.375 22.40625 L 9.25 24.625 L 7.9375 23.3125 L 11.8125 19.40625 L 10.40625 18 L 6.5 21.875 L 4.53125 19.90625 Z"/></svg>';
                clear.title = this.translations.confirmClear || this.translations.clearLog;

                clear.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!this.isAuthenticated) return;
                    if (await this.showConfirm(this.translations.confirmClear)) {
                        const result = await this.saveFile(filename, '');
                        if (!result.status) {
                            if (filename === currentFile) {
                                this.editor.setValue('');
                                this.originalContent = '';
                                this.checkForChanges();
                            }
                            this.showSuccess(this.translations.logCleared || 'Saved');
                        }
                    }
                });

                return clear;
            };

            const createTrashButton = (filename) => {
                const trash = document.createElement('div');
                trash.classList.add('nav-trash');
                trash.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
                trash.title = this.translations.confirmDelete || this.translations.deleteFile;

                trash.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!this.isAuthenticated) return;
                    const confirmDeleteText = this.translations.confirmDeleteWithName
                        ? this.translations.confirmDeleteWithName.replace('{filename}', filename)
                        : this.translations.confirmDelete;
                    if (await this.showConfirm(confirmDeleteText, this.translations.confirm)) {
                        const result = await this.removeFile(filename);
                        if (!result.status) {
                            this.tabs.remove(filename);
                            this.filesSet.delete(filename);
                            this.showSuccess(this.translations.fileDeleted || 'Saved');
                        }
                    }
                });

                return trash;
            };

            const bindTabClick = (tab, filename) => {
                tab.addEventListener('click', async () => {
                    if (tab.dataset.dragMoved === '1') {
                        tab.dataset.dragMoved = '0';
                        return;
                    }
                    if (!this.isAuthenticated) return;
                    await this.loadFile(filename);
                });
                tab.dataset.dragMoved = '0';
            };

            const bindTabDrag = (tab, filename) => {
                if (filename === 'nfqws.conf') return;
                tab.classList.add('draggable');

                const startDrag = (e) => {
                    if (!this.dom.tabs) return;
                    if (e.button !== undefined && e.button !== 0) return;
                    if (e.target && e.target.closest('.nav-trash, .nav-clear')) return;
                    const rect = tab.getBoundingClientRect();
                    dragState = {
                        tab,
                        startX: e.clientX,
                        lastX: e.clientX,
                        grabOffset: e.clientX - rect.left,
                        moved: false,
                        lastReorderAt: 0
                    };
                    tab.classList.add('dragging');
                    tab.dataset.dragMoved = '0';
                    document.body.classList.add(CLASSNAMES.draggingTabs);
                    if (supportsPointer && tab.setPointerCapture) {
                        tab.setPointerCapture(e.pointerId);
                    }
                    e.preventDefault();
                };

                const moveDrag = (e) => {
                    if (!dragState || dragState.tab !== tab) return;
                    const dx = e.clientX - dragState.startX;
                    if (Math.abs(dx) > 3) {
                        dragState.moved = true;
                        tab.dataset.dragMoved = '1';
                    }
                    const parentRect = this.dom.tabs.getBoundingClientRect();
                    const movingRight = e.clientX > (dragState.lastX + 1);
                    const movingLeft = e.clientX < (dragState.lastX - 1);
                    if (movingRight || movingLeft) {
                        dragState.lastX = e.clientX;
                    }
                    const pointerX = e.clientX - parentRect.left + this.dom.tabs.scrollLeft;
                    const tabs = Array.from(this.dom.tabs.querySelectorAll('.nav-tab'))
                        .filter((item) => item !== tab && item.dataset.filename !== 'nfqws.conf');
                    let reference = null;
                    for (const sibling of tabs) {
                        const rect = sibling.getBoundingClientRect();
                        const thresholdRatio = movingRight ? 0.3 : 0.7;
                        const threshold = rect.left - parentRect.left + this.dom.tabs.scrollLeft + rect.width * thresholdRatio;
                        if (pointerX < threshold) {
                            reference = sibling;
                            break;
                        }
                    }
                    const now = Date.now();
                    const hasReference = Boolean(reference);
                    const alreadyBefore = hasReference && tab.nextElementSibling === reference;
                    const alreadyAtEnd = !hasReference && tab === this.dom.tabs.lastElementChild;
                    if (!alreadyBefore && !alreadyAtEnd && now - dragState.lastReorderAt > 120) {
                        dragState.lastReorderAt = now;
                        const beforeRects = new Map();
                        tabs.forEach((item) => {
                            beforeRects.set(item, item.getBoundingClientRect());
                        });
                        if (reference) {
                            this.dom.tabs.insertBefore(tab, reference);
                        } else {
                            this.dom.tabs.appendChild(tab);
                        }
                        requestAnimationFrame(() => {
                            beforeRects.forEach((beforeRect, el) => {
                                const afterRect = el.getBoundingClientRect();
                                const dx = beforeRect.left - afterRect.left;
                                if (!dx) return;
                                el.style.transition = 'transform 0s';
                                el.style.transform = `translateX(${dx}px)`;
                                requestAnimationFrame(() => {
                                    el.style.transition = 'transform 720ms cubic-bezier(0.22, 0.61, 0.36, 1)';
                                    el.style.transform = '';
                                });
                            });
                        });
                    }
                    const slotRect = tab.getBoundingClientRect();
                    const slotCenter = slotRect.left + slotRect.width / 2;
                    const desiredOffset = e.clientX - slotCenter;
                    const maxMicro = 6;
                    const microOffset = Math.max(-maxMicro, Math.min(maxMicro, desiredOffset));
                    tab.style.transform = `translateX(${microOffset}px)`;
                };

                const endDrag = (e) => {
                    if (!dragState || dragState.tab !== tab) return;
                    tab.classList.remove('dragging');
                    tab.style.transform = '';
                    document.body.classList.remove(CLASSNAMES.draggingTabs);
                    if (supportsPointer && tab.releasePointerCapture) {
                        tab.releasePointerCapture(e.pointerId);
                    }
                    dragState = null;
                    this.ensurePrimaryTabFirst();
                    this.saveTabsOrder();
                    setTimeout(() => {
                        tab.dataset.dragMoved = '0';
                    }, 0);
                };

                if (supportsPointer) {
                    tab.addEventListener('pointerdown', startDrag);
                    window.addEventListener('pointermove', moveDrag);
                    window.addEventListener('pointerup', endDrag);
                    window.addEventListener('pointercancel', endDrag);
                } else {
                    tab.addEventListener('mousedown', startDrag);
                    window.addEventListener('mousemove', moveDrag);
                    window.addEventListener('mouseup', endDrag);
                }
            };

            const setCurrentFile = (filename) => {
                currentFile = filename;
                this.updateCurrentFilenameDisplay(filename);
                if (this.historyManager) {
                    this.historyManager.updateCurrentFile(filename);
                }
            };

            const resetEditorState = () => {
                this.editor.setValue('');
                this.originalContent = '';
                currentFile = '';
                this.currentFilename = '';
                this.updateCurrentFilenameDisplay('');
                this.checkForChanges();
            };

            const getFirstTabName = () => Object.keys(tabs)[0];

            const add = (filename) => {
                const tab = createTabElement(filename);

                const isLog = this.isLogFile(filename);
                const isProtected = this.protectedFiles.has(filename);
                const isList = this.isListFile(filename);
                const isConfOpkg = filename.includes('.conf-opkg');

                if (isLog && isProtected) {
                    tab.appendChild(createClearButton(filename));
                }

                if ((isLog && !isProtected) || (!isLog && !isProtected)) {
                    tab.appendChild(createTrashButton(filename));
                } else if (!isLog) {
                    tab.classList.add('secondary');
                    if (isProtected) {
                        tab.classList.add('protected');
                        tab.title = this.translations.protectedFile || '';
                    }
                }

                bindTabClick(tab, filename);
                bindTabDrag(tab, filename);

                this.dom.tabs.appendChild(tab);
                tabs[filename] = tab;
            };

            const removeTab = (filename) => {
                this.removeTab(tabs, filename, currentFile, getFirstTabName, resetEditorState);
            };

            const activate = (filename) => {
                this.activateTab(tabs, filename, setCurrentFile);
            };

            return {
                add,
                remove: removeTab,
                activate,
                get currentFileName() {
                    return currentFile;
                }
            };
        },

        removeTab(tabs, filename, currentFile, getFirstTabName, resetEditorState) {
            const tab = tabs[filename];
            if (tab) {
                tab.parentNode.removeChild(tab);
                delete tabs[filename];

                if (filename === currentFile) {
                    const firstTab = getFirstTabName();
                    if (firstTab) {
                        this.loadFile(firstTab);
                    } else {
                        resetEditorState();
                    }
                }
            }
        },

        activateTab(tabs, filename, setCurrentFile) {
            Object.values(tabs).forEach(tab => {
                tab.classList.toggle(CLASSNAMES.active, tab.dataset.filename === filename);
            });
            setCurrentFile(filename);
        },

        ensurePrimaryTabFirst() {
            if (!this.dom.tabs) return;
            const firstTab = this.dom.tabs.querySelector('.nav-tab[data-filename=\"nfqws.conf\"]');
            if (firstTab && firstTab.parentElement === this.dom.tabs) {
                this.dom.tabs.insertBefore(firstTab, this.dom.tabs.firstChild);
            }
        },

        saveTabsOrder() {
            if (!this.dom.tabs) return;
            const order = Array.from(this.dom.tabs.querySelectorAll('.nav-tab'))
                .map((tab) => tab.dataset.filename)
                .filter(Boolean);
            localStorage.setItem(STORAGE_KEYS.tabsOrder, JSON.stringify(order));
        },

        applyTabsOrder(files) {
            const stored = localStorage.getItem(STORAGE_KEYS.tabsOrder);
            if (!stored) return files;
            let order;
            try {
                order = JSON.parse(stored);
            } catch (error) {
                return files;
            }
            if (!Array.isArray(order)) return files;
            const orderSet = new Set(order);
            const sorted = [];
            order.forEach((name) => {
                if (files.includes(name)) {
                    sorted.push(name);
                }
            });
            files.forEach((name) => {
                if (!orderSet.has(name)) {
                    sorted.push(name);
                }
            });
            return sorted;
        }
    });
}
