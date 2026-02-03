export function applyFiles(UI) {
    Object.assign(UI.prototype, {
        async loadFiles() {
            try {
                const response = await this.getFiles();
                this.setStatus(response.service);

                if (response.files?.length) {
                    const orderedFiles = this.applyTabsOrder(response.files);
                    if (this.dom.tabs) {
                        this.dom.tabs.innerHTML = '';
                    }
                    this.tabs = this.initTabs();
                    this.filesSet = new Set(orderedFiles);
                    orderedFiles.forEach((file) => this.tabs.add(file));
                    this.ensurePrimaryTabFirst();

                    const firstFile = orderedFiles[0];
                    if (firstFile) {
                        await this.loadFile(firstFile);
                    }
                }
            } catch (error) {
                console.error('Error loading files:', error);
            }
        },

        async loadFile(filename) {
            if (!this.isAuthenticated) return;
            if (!(await this.confirmDiscardChanges())) return;

            try {
                this.tabs.activate(filename);
                this.currentFilename = filename;
                this.updateListCheckButton();

                const content = await this.safeGetFileContent(filename, {
                    onErrorMessage: this.translations.failedToLoadFile
                });
                if (content === null) return;

                this.setEditorContent(content, filename, { setReadOnly: true });
                this.updateListDuplicateMarkers();
                this.resetHistoryForFile(filename);
                this.editor.focus();
            } catch (error) {
                console.error('Error loading file:', error);
                this.showError(`${this.translations.error}: ${this.translations.failedToLoadFile}`);
            }
        }
    });
}
