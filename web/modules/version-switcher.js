export function applyVersionSwitcher(UI) {
    Object.assign(UI.prototype, {
        initVersionSwitcher() {
            const buttons = this.dom.versionSwitcherButtons;
            if (!buttons) return;
            buttons.forEach((button) => {
                button.addEventListener('click', () => {
                    this.hideMenu?.(this.dom.dropdownMenu);
                    this.showSwitchVersionPopup();
                });
            });
        },

        initSwitchVersionPopup() {
            const popup = this.dom.switchVersionPopup;
            if (!popup) return;

            const closeButtons = [
                this.dom.switchVersionCancel,
                popup.querySelector('.popup-close-btn')
            ];
            closeButtons.filter(Boolean).forEach((btn) => {
                btn.addEventListener('click', () => this.closeSwitchVersionPopup());
            });

            const confirmBtn = this.dom.switchVersionConfirm;
            if (confirmBtn) {
                confirmBtn.addEventListener('click', () => this.confirmSwitchVersion());
            }

            const versionRadios = popup.querySelectorAll('input[name="version"]');
            versionRadios.forEach((radio) => {
                radio.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        this.updateVersionInfo(e.target.value);
                        if (confirmBtn) confirmBtn.disabled = false;
                    }
                });
            });
        },

        async loadVersionsInfo() {
            const response = await this.postData({ cmd: 'versions' });
            if (!response || response.status !== 0) return null;

            this.versionsInfo = {
                nfqws: response.nfqws || { installed: false, version: 'unknown', active: false },
                nfqws2: response.nfqws2 || { installed: false, version: 'unknown', active: false }
            };
            this.activeVersion = response.activeVersion || 'none';
            this.selectedVersion = response.selectedVersion || this.activeVersion || 'nfqws';
            return response;
        },

        async showSwitchVersionPopup() {
            if (!this.isAuthenticated) return;
            const popup = this.dom.switchVersionPopup;
            if (!popup) return;

            await this.loadVersionsInfo();

            if (this.dom.switchVersionTitle) {
                this.dom.switchVersionTitle.textContent = this.translations.switchVersionTitle || 'Switch Version';
            }
            if (this.dom.currentVersionLabel) {
                this.dom.currentVersionLabel.textContent = this.translations.currentVersion || 'Current Version:';
            }
            if (this.dom.selectVersionLabel) {
                this.dom.selectVersionLabel.textContent = this.translations.selectVersion || 'Select Version:';
            }

            if (this.dom.currentVersionDisplay) {
                if (this.activeVersion === 'none') {
                    this.dom.currentVersionDisplay.textContent = this.translations.notInstalled || 'Not installed';
                } else {
                    const name = this.activeVersion === 'nfqws2' ? 'NFQWS2' : 'NFQWS';
                    const info = this.versionsInfo[this.activeVersion];
                    const vtext = info && info.version !== 'unknown' ? `v${info.version}` : '';
                    this.dom.currentVersionDisplay.textContent = `${name} ${vtext}`.trim();
                }
            }

            this.updateVersionStatuses();
            this.resetVersionInfo();

            const confirmBtn = this.dom.switchVersionConfirm;
            if (confirmBtn) confirmBtn.disabled = true;

            const selected = popup.querySelector(`input[name="version"][value="${this.selectedVersion}"]`);
            if (selected) {
                selected.checked = true;
                this.updateVersionInfo(this.selectedVersion);
                if (confirmBtn) confirmBtn.disabled = false;
            }

            this.openPopup(popup);
        },

        closeSwitchVersionPopup() {
            const popup = this.dom.switchVersionPopup;
            if (!popup) return;
            this.closePopupSimple(popup);
        },

        updateVersionStatuses() {
            const nfqwsStatus = this.dom.nfqwsStatus;
            if (nfqwsStatus) {
                const info = this.versionsInfo.nfqws;
                if (info.installed) {
                    const vtext = info.version !== 'unknown' ? `v${info.version}` : '';
                    nfqwsStatus.textContent = info.active
                        ? `✓ ${this.translations.active || 'Active'} ${vtext}`.trim()
                        : `○ ${vtext}`.trim();
                    nfqwsStatus.className = 'version-status ' + (info.active ? 'active' : 'installed');
                } else {
                    nfqwsStatus.textContent = `✗ ${this.translations.notInstalled || 'Not installed'}`;
                    nfqwsStatus.className = 'version-status not-installed';
                }
            }

            const nfqws2Status = this.dom.nfqws2Status;
            if (nfqws2Status) {
                const info = this.versionsInfo.nfqws2;
                if (info.installed) {
                    const vtext = info.version !== 'unknown' ? `v${info.version}` : '';
                    nfqws2Status.textContent = info.active
                        ? `✓ ${this.translations.active || 'Active'} ${vtext}`.trim()
                        : `○ ${vtext}`.trim();
                    nfqws2Status.className = 'version-status ' + (info.active ? 'active' : 'installed');
                } else {
                    nfqws2Status.textContent = `✗ ${this.translations.notInstalled || 'Not installed'}`;
                    nfqws2Status.className = 'version-status not-installed';
                }
            }
        },

        updateVersionInfo(version) {
            const info = this.versionsInfo[version];
            if (!info || !info.installed) {
                this.resetVersionInfo();
                return;
            }

            if (this.dom.versionInfo) {
                this.dom.versionInfo.classList.remove('is-hidden');
            }
            if (this.dom.selectedVersionStatus) {
                this.dom.selectedVersionStatus.textContent = info.active
                    ? this.translations.active || 'Active'
                    : this.translations.inactive || 'Inactive';
                this.dom.selectedVersionStatus.className = 'info-value ' + (info.active ? 'active' : 'inactive');
            }
            if (this.dom.selectedVersionValue) {
                this.dom.selectedVersionValue.textContent = info.version !== 'unknown' ? `v${info.version}` : 'unknown';
                this.dom.selectedVersionValue.className = 'info-value';
            }
            if (this.dom.selectedInstalled) {
                this.dom.selectedInstalled.textContent = this.translations.installed || 'Installed';
                this.dom.selectedInstalled.className = 'info-value installed';
            }

            if (this.dom.switchWarning) {
                this.dom.switchWarning.classList.remove('is-hidden');
            }
            if (this.dom.warningText) {
                if (version !== this.activeVersion && this.activeVersion !== 'none') {
                    this.dom.warningText.textContent = this.translations.switchWarning || 'Service will be restarted during switching';
                } else {
                    this.dom.warningText.textContent = this.translations.selectWarning || 'Only version selection, service will not be started';
                }
            }
        },

        resetVersionInfo() {
            if (this.dom.selectedVersionStatus) this.dom.selectedVersionStatus.textContent = '-';
            if (this.dom.selectedVersionValue) this.dom.selectedVersionValue.textContent = '-';
            if (this.dom.selectedInstalled) this.dom.selectedInstalled.textContent = '-';
            if (this.dom.versionInfo) this.dom.versionInfo.classList.add('is-hidden');
            if (this.dom.switchWarning) this.dom.switchWarning.classList.add('is-hidden');
        },

        async confirmSwitchVersion() {
            const popup = this.dom.switchVersionPopup;
            if (!popup) return;

            const selected = popup.querySelector('input[name="version"]:checked');
            if (!selected) return;
            const target = selected.value;

            if (target === this.selectedVersion) {
                this.showError(this.translations.alreadySelected || 'Already selected');
                return;
            }

            const info = this.versionsInfo[target];
            if (!info || !info.installed) {
                this.showError(this.translations.versionNotInstalled || 'Version not installed');
                return;
            }

            const needsSwitch = this.activeVersion !== 'none' && this.activeVersion !== target;
            const confirmText = needsSwitch
                ? this.translations.confirmSwitch || 'Switch version and restart service?'
                : this.translations.confirmSelect || 'Select version for editing?';

            this.closeSwitchVersionPopup();
            const confirmed = await this.showConfirm(confirmText, this.translations.confirm);
            if (!confirmed) return;

            const action = needsSwitch ? 'switch' : 'select';
            const processingText = needsSwitch
                ? this.translations.switching || 'Switching version...'
                : this.translations.selecting || 'Selecting version...';

            const success = await this.showProcessing(
                processingText,
                () => this.postData({ cmd: action, version: target }),
                this.translations.processing
            );

            if (!success) return;

            await this.loadVersionsInfo();
            await this.loadFiles();
            this.updateServiceMeta({ nfqws2: this.selectedVersion === 'nfqws2' });

            if (needsSwitch) {
                this.showSuccess(this.translations.versionSwitched || 'Version switched successfully');
            } else {
                this.showSuccess(this.translations.versionSelected || 'Version selected for editing');
            }
        }
    });
}
