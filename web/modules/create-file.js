export function applyCreateFile(UI) {
    Object.assign(UI.prototype, {
        initCreateFilePopup() {
            const popup = this.dom.createFilePopup;
            const input = this.dom.createFileName;
            const title = this.dom.createFileTitle;
            const confirmBtn = this.dom.createFileConfirm;
            const cancelBtn = this.dom.createFileCancel;
            const closeBtn = this.dom.createFileClose;

            const closePopup = () => {
                this.closePopupSimple(popup);
            };

            const submit = async () => {
                if (!this.isAuthenticated) return;
                const filename = input.value.trim();

                if (!filename) {
                    this.showError(`${this.translations.error}: ${this.translations.fileNameRequired}`);
                    return;
                }

                if (!/^[A-Za-z0-9._-]+$/.test(filename) || filename.includes('..')) {
                    this.showError(`${this.translations.error}: ${this.translations.fileNameInvalidDetails}`);
                    return;
                }

                if (!/[^.]+\.[^.]+$/.test(filename)) {
                    this.showError(`${this.translations.error}: ${this.translations.fileExtensionRequired}`);
                    return;
                }

                if (this.protectedFiles.has(filename)) {
                    this.showError(`${this.translations.error}: ${this.translations.fileNameReserved}`);
                    return;
                }

                if (this.filesSet.has(filename)) {
                    this.showError(`${this.translations.error}: ${this.translations.fileAlreadyExists}`);
                    return;
                }

                const escaped = window.CSS && CSS.escape ? CSS.escape(filename) : filename.replace(/\"/g, '\\"');
                if (this.dom.tabs.querySelector(`.nav-tab[data-filename="${escaped}"]`)) {
                    this.showError(`${this.translations.error}: ${this.translations.fileAlreadyExists}`);
                    return;
                }

                const result = await this.saveFile(filename, '');
                if (result && !result.status) {
                    this.tabs.add(filename);
                    this.filesSet.add(filename);
                    await this.loadFile(filename);
                    closePopup();
                } else {
                    this.showError(`${this.translations.error}: ${this.translations.failedToCreateFile}`);
                }
            };

            confirmBtn.addEventListener('click', submit);
            cancelBtn.addEventListener('click', closePopup);
            closeBtn.addEventListener('click', closePopup);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    submit();
                }
            });

            this.showCreateFilePopup = () => {
                title.textContent = this.translations.createFileTitle;
                input.placeholder = this.translations.createFilePlaceholder;
                input.value = '';
                this.openPopup(popup, { focusEl: input });
            };
        }
    });
}
