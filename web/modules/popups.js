import { CLASSNAMES } from './constants.js';

export function applyPopups(UI) {
    Object.assign(UI.prototype, {
        initAvailabilityPopup() {
            const popup = this.dom.availabilityPopup;
            const closeBtn = this.dom.availabilityClose;
            const headerCloseBtn = popup.querySelector('.popup-close-btn');
            
            this.bindPopupClose(popup, closeBtn, headerCloseBtn);
        },

        showLoginForm() {
            const loginForm = this.dom.loginForm;
            const loginInput = this.dom.loginInput;
            const loginButton = this.dom.loginButton;
            const loginTitle = this.dom.loginTitle;
            
            loginTitle.textContent = this.translations.login || 'Login';
            loginButton.textContent = this.translations.login || 'Login';
            this.openPopup(loginForm, { focusEl: loginInput });
            loginInput.value = '';
            this.dom.passwordInput.value = '';
        },

        initAddFileButton() {
            const addButton = this.dom.addFile;
            if (!addButton) return;
            addButton.title = this.translations.createFile || 'Create file';
            if (!addButton.dataset.bound) {
                addButton.addEventListener('click', () => {
                    if (!this.isAuthenticated) return;
                    this.showCreateFilePopup();
                });
                addButton.dataset.bound = 'true';
            }
            this.addButton = addButton;
        },

        initPopups() {
            const popup = this.dom.alertPopup;
            const content = this.dom.popupContent;
            const buttonClose = this.dom.popupClose;
            const buttonYes = this.dom.popupYes;
            const buttonNo = this.dom.popupNo;
            const popupTitle = this.dom.popupTitle;
            const closeButton = popup.querySelector('.popup-close-btn');
            
            this.resolveCallback = null;
            let isProcessing = false;

            // Close buttons
            buttonClose.addEventListener('click', () => {
                this.closePopup(popup, false);
            });

            // Close button in header
            closeButton.addEventListener('click', () => {
                this.closePopup(popup, false);
            });

            // Yes/No buttons
            buttonYes.addEventListener('click', () => {
                if (!isProcessing) {
                    this.closePopup(popup, true);
                }
            });

            buttonNo.addEventListener('click', () => {
                if (!isProcessing) {
                    this.closePopup(popup, false);
                }
            });

            const setPopupText = (message, title = '') => {
                content.textContent = message;
                popupTitle.textContent = title || '';
            };

            // Store methods
            this.showAlert = (message, title = '') => {
                return new Promise((resolve) => {
                    setPopupText(message, title);
                    this.openPopup(popup);
                    this.setAlertPopupMode(popup, CLASSNAMES.alert);
                    this.resolveCallback = resolve;
                });
            };

            this.showConfirm = (message, title = '') => {
                return new Promise((resolve) => {
                    setPopupText(message, title);
                    this.openPopup(popup);
                    this.setAlertPopupMode(popup, CLASSNAMES.confirm);
                    this.resolveCallback = resolve;
                });
            };

            this.showProcessing = async (message, action, title = '') => {
                return new Promise(async (resolve) => {
                    if (!this.isAuthenticated) {
                        resolve(false);
                        return;
                    }
                    
                    setPopupText(`${message}\n\n${this.translations.processing}`, title);
                    this.openPopup(popup);
                    this.setAlertPopupMode(popup, 'processing');
                    isProcessing = true;
                    
                    try {
                        const result = await action();
                        if (result && !result.status) {
                            setPopupText(`${message}\n\n✅ ${this.translations.success}!`, title);
                            if (result.output) {
                                content.textContent += `\n${result.output.join('\n')}`;
                            }
                            resolve(true);
                        } else {
                            const unknownError = this.translations.unknownError;
                            setPopupText(`${message}\n\n❌ ${this.translations.error}: ${result ? result.status : unknownError}`, title);
                            if (result && result.output) {
                                content.textContent += `\n${result.output.join('\n')}`;
                            }
                            resolve(false);
                        }
                    } catch (error) {
                        setPopupText(`${message}\n\n❌ ${this.translations.error}: ${error.message}`, title);
                        resolve(false);
                    } finally {
                        this.setAlertPopupMode(popup, CLASSNAMES.alert);
                        isProcessing = false;
                    }
                });
            };
        },

        initOverlayDismiss() {
            const overlay = this.dom.overlay;
            if (!overlay) return;

            const closeByClicking = (button) => {
                if (button && typeof button.click === 'function') {
                    button.click();
                    return true;
                }
                return false;
            };

            overlay.addEventListener('click', () => {
                if (!document.body.classList.contains(CLASSNAMES.disabled)) return;

                const alertPopup = this.dom.alertPopup;
                if (alertPopup && alertPopup.classList.contains(CLASSNAMES.locked)) {
                    return;
                }

                const comparePopup = this.dom.comparePopup;
                if (comparePopup && !comparePopup.classList.contains(CLASSNAMES.hidden)) {
                    if (this.isCompareMobile()) {
                        if (closeByClicking(this.dom.compareCloseMobile)) return;
                    }
                    if (closeByClicking(this.dom.compareCloseDesktop)) return;
                }

                const availabilityPopup = this.dom.availabilityPopup;
                if (availabilityPopup && !availabilityPopup.classList.contains(CLASSNAMES.hidden)) {
                    if (closeByClicking(this.dom.availabilityClose)) return;
                    if (closeByClicking(availabilityPopup.querySelector('.popup-close-btn'))) return;
                }

                const duplicatesPopup = this.dom.duplicatesPopup;
                if (duplicatesPopup && !duplicatesPopup.classList.contains(CLASSNAMES.hidden)) {
                    if (closeByClicking(this.dom.duplicatesClose)) return;
                    if (closeByClicking(this.dom.duplicatesCloseBtn)) return;
                }

                const loginPopup = this.dom.loginForm;
                if (loginPopup && !loginPopup.classList.contains(CLASSNAMES.hidden)) {
                    if (closeByClicking(loginPopup.querySelector('.popup-close-btn'))) return;
                }

                const createPopup = this.dom.createFilePopup;
                if (createPopup && !createPopup.classList.contains(CLASSNAMES.hidden)) {
                    if (closeByClicking(this.dom.createFileCancel)) return;
                    if (closeByClicking(createPopup.querySelector('.popup-close-btn'))) return;
                }

                if (alertPopup && !alertPopup.classList.contains(CLASSNAMES.hidden)) {
                    if (closeByClicking(this.dom.popupClose)) return;
                }
            });
        },

        openPopup(popup, { focusEl } = {}) {
            if (!popup) return;
            popup.classList.remove(CLASSNAMES.hidden);
            document.body.classList.add(CLASSNAMES.disabled);
            if (focusEl && typeof focusEl.focus === 'function') {
                focusEl.focus();
            }
        },

        bindPopupClose(popup, ...buttons) {
            if (!popup) return;
            buttons.filter(Boolean).forEach((button) => {
                button.addEventListener('click', () => this.closePopupSimple(popup));
            });
        },

        setAlertPopupMode(popup, mode) {
            if (!popup) return;
            const isConfirm = mode === CLASSNAMES.confirm;
            const isProcessing = mode === 'processing';
            popup.classList.toggle(CLASSNAMES.alert, !isConfirm);
            popup.classList.toggle(CLASSNAMES.confirm, isConfirm);
            popup.classList.toggle(CLASSNAMES.locked, isProcessing);
        },

        closePopupSimple(popup) {
            if (!popup) return;
            popup.classList.add(CLASSNAMES.hidden);
            document.body.classList.remove(CLASSNAMES.disabled);
        },

        setButtonLoading(button, textEl, loadingText) {
            const originalText = textEl ? textEl.textContent : '';
            if (button) {
                button.disabled = true;
                button.classList.add(CLASSNAMES.disabled);
            }
            if (textEl && loadingText) {
                textEl.textContent = loadingText;
            }
            return originalText;
        },

        restoreButton(button, textEl, originalText) {
            if (button) {
                button.disabled = false;
                button.classList.remove(CLASSNAMES.disabled);
            }
            if (textEl) {
                textEl.textContent = originalText;
            }
        },

        closePopup(popup, result) {
            this.closePopupSimple(popup);
            if (this.resolveCallback) {
                this.resolveCallback(result);
                this.resolveCallback = null;
            }
        }
    });
}
