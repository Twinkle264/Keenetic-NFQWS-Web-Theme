export function applyDuplicates(UI) {
    Object.assign(UI.prototype, {
        scheduleListDuplicateUpdate() {
            if (this.listDuplicateTimer) {
                clearTimeout(this.listDuplicateTimer);
            }
            this.listDuplicateTimer = setTimeout(() => {
                this.updateListDuplicateMarkers();
            }, 600);
        },

        clearListDuplicateMarkers() {
            if (this.listDuplicateMarkers.length) {
                this.listDuplicateMarkers.forEach((marker) => marker.clear());
            }
            this.listDuplicateMarkers = [];
            if (this.listDuplicateLineHandles.length) {
                this.listDuplicateLineHandles.forEach((handle) => {
                    this.editor.removeLineClass(handle, 'background', 'list-duplicate-line');
                });
            }
            this.listDuplicateLineHandles = [];
        },

        updateListDuplicateMarkers() {
            if (!this.editor) return;
            this.clearListDuplicateMarkers();

            if (!this.isListFile(this.currentFilename)) return;

            const content = this.editor.getValue();
            const lines = content.split(/\r?\n/);
            const map = new Map();

            lines.forEach((line, idx) => {
                const trimmed = line.trim();
                if (!trimmed) return;
                if (trimmed.startsWith('#') || trimmed.startsWith('//')) return;
                if (!map.has(trimmed)) {
                    map.set(trimmed, []);
                }
                map.get(trimmed).push(idx);
            });

            const noteText = this.translations.listDuplicateNote || 'Duplicate in this list';
            for (const [value, indices] of map.entries()) {
                if (indices.length < 2) continue;
                indices.forEach((line) => {
                    const handle = this.editor.getLineHandle(line);
                    this.editor.addLineClass(handle, 'background', 'list-duplicate-line');
                    this.listDuplicateLineHandles.push(handle);
                    const lineText = this.editor.getLine(line) || '';
                    const markerPos = { line, ch: lineText.length };
                    const span = document.createElement('span');
                    span.className = 'list-duplicate-note';
                    span.textContent = ` ${noteText}`;
                    const marker = this.editor.setBookmark(markerPos, {
                        widget: span,
                        insertLeft: true
                    });
                    this.listDuplicateMarkers.push(marker);
                });
            }
        },

        initDuplicatesPopup() {
            const popup = this.dom.duplicatesPopup;
            const closeBtn = this.dom.duplicatesClose;
            const closeIcon = this.dom.duplicatesCloseBtn;
            if (!popup) return;

            const close = async () => {
                this.closePopupSimple(popup);
                if (this.currentFilename) {
                    try {
                        const content = await this.getFileContent(this.currentFilename);
                        if (this.editor) {
                            this.setEditorContent(content, this.currentFilename);
                        }
                    } catch (error) {
                        console.error('Error refreshing file after compare:', error);
                    }
                }
            };

            if (closeBtn) closeBtn.addEventListener('click', close);
            if (closeIcon) closeIcon.addEventListener('click', close);
        },

        parseListLines(content) {
            const lines = content.split(/\r?\n/);
            const entries = [];
            lines.forEach((line, idx) => {
                const trimmed = line.trim();
                if (!trimmed) return;
                if (trimmed.startsWith('#') || trimmed.startsWith('//')) return;
                entries.push({ value: trimmed, lineNumber: idx + 1 });
            });
            return entries;
        },

        async checkListDuplicates() {
            if (!this.isAuthenticated) return;

            const filename = this.currentFilename;
            if (!this.ensureListFileSelected(filename, this.translations.selectListFile || 'Выберите файл .list для проверки доменов')) {
                return;
            }

            const popup = this.dom.duplicatesPopup;
            const totalEl = this.dom.duplicatesTotal;
            const foundEl = this.dom.duplicatesFound;
            const filesEl = this.dom.duplicatesFiles;
            const listEl = this.dom.duplicatesList;

            if (!popup || !listEl) return;

            this.resetDuplicatesUI({ listEl, totalEl, foundEl, filesEl });
            this.openPopup(popup);

            const { currentEntries, currentSet, listFiles } = this.collectDuplicateInputs(filename);
            this.updateDuplicateStats({ totalEl, filesEl }, currentEntries.length, listFiles.length);

            if (!currentEntries.length || !listFiles.length) {
                this.renderDuplicatesEmpty(listEl);
                return;
            }

            const { duplicatesMap, fullDuplicateFiles } = await this.collectDuplicateMatches({
                listFiles,
                currentEntries,
                currentSet
            });

            const results = this.buildDuplicateResults(currentEntries, duplicatesMap);

            this.updateDuplicateFound(foundEl, results.length);
            listEl.innerHTML = '';

            if (!results.length) {
                this.renderDuplicatesEmpty(listEl);
                return;
            }

            this.renderDuplicateResults(listEl, results, fullDuplicateFiles);
            this.bindDuplicateCompareButtons(listEl);
        },

        collectDuplicateInputs(filename) {
            const currentContent = this.editor ? this.editor.getValue() : '';
            const currentEntries = this.parseListLines(currentContent);
            const currentSet = new Set(currentEntries.map((entry) => entry.value));
            const listFiles = Array.from(this.filesSet || []).filter((file) => {
                return this.isListFile(file) && file !== filename;
            });
            return { currentEntries, currentSet, listFiles };
        },

        updateDuplicateStats({ totalEl, filesEl }, totalCount, filesCount) {
            if (totalEl) totalEl.textContent = String(totalCount);
            if (filesEl) filesEl.textContent = String(filesCount);
        },

        updateDuplicateFound(foundEl, count) {
            if (foundEl) foundEl.textContent = String(count);
        },

        async collectDuplicateMatches({ listFiles, currentEntries, currentSet }) {
            const duplicatesMap = new Map();
            const fullDuplicateFiles = [];

            for (const file of listFiles) {
                try {
                    const content = await this.safeGetFileContent(file);
                    if (content === null) return;
                    const entries = this.parseListLines(content);
                    const fileSet = new Set(entries.map((entry) => entry.value));
                    const isSameSize = entries.length === currentEntries.length;
                    let isFullDuplicate = false;
                    if (isSameSize && fileSet.size === currentSet.size) {
                        isFullDuplicate = true;
                        for (const value of fileSet) {
                            if (!currentSet.has(value)) {
                                isFullDuplicate = false;
                                break;
                            }
                        }
                    }
                    if (isFullDuplicate) {
                        fullDuplicateFiles.push(file);
                        continue;
                    }
                    entries.forEach((entry) => {
                        if (!currentSet.has(entry.value)) return;
                        if (!duplicatesMap.has(entry.value)) {
                            duplicatesMap.set(entry.value, []);
                        }
                        duplicatesMap.get(entry.value).push({
                            file,
                            lineNumber: entry.lineNumber
                        });
                    });
                } catch (error) {
                    console.error('Error loading list for duplicate check:', file, error);
                }
            }

            return { duplicatesMap, fullDuplicateFiles };
        },

        buildDuplicateResults(currentEntries, duplicatesMap) {
            const results = [];
            currentEntries.forEach((entry) => {
                const matches = duplicatesMap.get(entry.value);
                if (matches && matches.length) {
                    results.push({
                        value: entry.value,
                        lineNumber: entry.lineNumber,
                        matches
                    });
                }
            });
            return results;
        },

        resetDuplicatesUI({ listEl, totalEl, foundEl, filesEl }) {
            listEl.innerHTML = '';
            if (totalEl) totalEl.textContent = '0';
            if (foundEl) foundEl.textContent = '0';
            if (filesEl) filesEl.textContent = '0';
        },

        renderDuplicatesEmpty(listEl) {
            const fragment = document.createDocumentFragment();
            const item = document.createElement('div');
            item.className = 'duplicate-item';
            item.innerHTML = `<div class="duplicate-meta">${this.translations.duplicatesNone || 'No duplicates found'}</div>`;
            fragment.appendChild(item);
            listEl.innerHTML = '';
            listEl.appendChild(fragment);
        },

        renderDuplicateResults(listEl, results, fullDuplicateFiles) {
            const currentLabel = this.translations.duplicatesCurrentLine || 'Current line';
            const lineLabel = this.translations.duplicatesLineLabel || 'line';
            const compareLabel = this.translations.duplicatesCompare || 'Compare';
            const fullMatchTemplate = this.translations.duplicatesFullMatch || 'List {filename} fully duplicates this list';

            const fragment = document.createDocumentFragment();

            fullDuplicateFiles.forEach((file) => {
                const item = document.createElement('div');
                item.className = 'duplicate-item full-duplicate';
                const message = fullMatchTemplate.replace('{filename}', `<span class="full-duplicate-name">${file}</span>`);
                item.innerHTML = `
                    <div class="duplicate-header">
                        <div class="duplicate-meta"><span class="full-duplicate-dot"></span>${message}</div>
                        <button class="button duplicate-compare" type="button" data-compare-file="${file}" data-compare-line="1" data-current-line="1">${compareLabel}</button>
                    </div>
                `;
                fragment.appendChild(item);
            });

            results.forEach((result) => {
                const item = document.createElement('div');
                item.className = 'duplicate-item';
                const locations = result.matches.map((match) => {
                    return `
                        <div class="duplicate-location">
                            <span>${match.file}</span>
                            <span>${lineLabel} ${match.lineNumber}</span>
                        <button class="button duplicate-compare" type="button" data-compare-file="${match.file}" data-compare-line="${match.lineNumber}" data-current-line="${result.lineNumber}">${compareLabel}</button>
                        </div>
                    `;
                }).join('');
                item.innerHTML = `
                    <div class="duplicate-top">
                        <div class="duplicate-header">
                            <div class="duplicate-value">${result.value}</div>
                        </div>
                        <div class="duplicate-meta">${currentLabel}: ${result.lineNumber}</div>
                    </div>
                    <div class="duplicate-locations">${locations}</div>
                `;
                fragment.appendChild(item);
            });

            listEl.appendChild(fragment);
        },

        bindDuplicateCompareButtons(listEl) {
            listEl.querySelectorAll('.duplicate-compare').forEach((button) => {
                button.addEventListener('click', async (event) => {
                    event.preventDefault();
                    const file = button.getAttribute('data-compare-file');
                    const line = parseInt(button.getAttribute('data-compare-line'), 10);
                    const currentLine = parseInt(button.getAttribute('data-current-line'), 10);
                    if (!file) return;
                    await this.openComparePopup(
                        file,
                        Number.isFinite(line) ? line : 1,
                        Number.isFinite(currentLine) ? currentLine : 1
                    );
                });
            });
        }
    });
}
