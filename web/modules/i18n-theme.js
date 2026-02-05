import { CLASSNAMES, STORAGE_KEYS, THEMES, CM_THEMES } from './constants.js';

export function applyI18nTheme(UI) {
    Object.assign(UI.prototype, {
        initLanguageSwitcher() {
            const switcher = this.dom.languageSwitcher;
            
            // Устанавливаем активный язык при загрузке
            this.updateLanguageSwitcher();
            
            switcher.addEventListener('click', (e) => {
                if (e.target.classList.contains('language-option')) {
                    const lang = e.target.dataset.lang;
                    this.switchLanguage(lang);
                }
            });
        },
        
        updateLanguageSwitcher() {
            this.dom.languageOptions.forEach(option => {
                option.classList.remove(CLASSNAMES.active);
                if (option.dataset.lang === this.currentLang) {
                    option.classList.add(CLASSNAMES.active);
                }
            });
        },

        initThemeSwitcher() {
            this.dom.theme.addEventListener('click', () => this.toggleTheme());
        },

        async switchLanguage(lang) {
            this.currentLang = lang;
            localStorage.setItem(STORAGE_KEYS.lang, lang);
            document.documentElement.lang = lang;
            
            await this.loadTranslations();
            this.applyTranslations();
            this.updateLanguageSwitcher();
        },

        // === UI Translations ===
        applyTranslations() {
            // Buttons
            this.dom.saveText.textContent = this.translations.save;
            if (this.dom.restartTextEls) {
                this.dom.restartTextEls.forEach((el) => {
                    el.textContent = this.translations.restart;
                });
            }
            this.dom.reloadText.textContent = this.translations.reload;
            this.dom.stopText.textContent = this.translations.stop;
            this.dom.startText.textContent = this.translations.start;
            this.dom.updateText.textContent = this.translations.update;
            this.dom.saveFsText.textContent = this.translations.save;
            this.dom.checkAvailabilityText.textContent = this.translations.checkAvailability || 'Проверить доступность';
            
            // Popup buttons
            this.dom.popupYes.textContent = this.translations.yes;
            this.dom.popupNo.textContent = this.translations.no;
            this.dom.popupClose.textContent = this.translations.close;
            
            // Popup titles
            this.dom.loginTitle.textContent = this.translations.login;
            this.dom.loginButton.textContent = this.translations.login;
            this.dom.createFileTitle.textContent = this.translations.createFileTitle;
            this.dom.createFileConfirm.textContent = this.translations.createFile;
            this.dom.createFileCancel.textContent = this.translations.cancel;
            this.dom.createFileName.placeholder = this.translations.createFilePlaceholder;
            
        // Availability popup
        this.dom.availabilityTitle.textContent = this.translations.checkingDomains || 'Проверка доступности доменов';
        this.dom.availabilityClose.textContent = this.translations.close || 'Закрыть';
        if (this.dom.availabilityRetry) {
            this.dom.availabilityRetry.textContent = this.translations.retryCheck || 'Повторить';
        }
        if (this.dom.availabilityCancel) {
            this.dom.availabilityCancel.textContent = this.translations.cancelCheck || 'Остановить';
        }
            
            // Statistics labels
            const totalLabel = this.dom.totalLabel;
            const accessibleLabel = this.dom.accessibleLabel;
            const blockedLabel = this.dom.blockedLabel;
            const progressLabel = this.dom.progressLabel;
            
            if (totalLabel) totalLabel.textContent = this.translations.totalDomains || 'Всего';
            if (accessibleLabel) accessibleLabel.textContent = this.translations.accessibleDomains || 'Доступны';
            if (blockedLabel) blockedLabel.textContent = this.translations.blockedDomains || 'Заблокированы';
            if (progressLabel) progressLabel.textContent = this.translations.progress || 'Прогресс';
            
            // Editor
            if (this.editor) {
                this.editor.setOption("placeholder", this.translations.placeholder);
            }
            
            // Filename
            this.dom.currentFilename.textContent = this.currentFilename || this.translations.noFileSelected;
            const checkListButton = this.dom.checkList;
            if (checkListButton) {
                checkListButton.classList.toggle(CLASSNAMES.hidden, !this.isListFile(this.currentFilename));
            }
            
            // Titles
            this.dom.editorFullscreen.title = this.translations.fullscreen;
            this.dom.theme.title = this.translations.themeLight;
            this.dom.logout.title = this.translations.logout;
            this.dom.languageSwitcher.title = this.translations.language;
            this.dom.checkAvailability.title = this.translations.checkAvailability || 'Проверить доступность доменов';
            if (checkListButton) {
                checkListButton.title = this.translations.checkLists || 'Check lists';
            }
            const checkListText = this.dom.checkListText;
            if (checkListText) {
                checkListText.textContent = this.translations.checkLists || 'Check lists';
            }
            const duplicatesTitle = this.dom.duplicatesTitle;
            if (duplicatesTitle) duplicatesTitle.textContent = this.translations.duplicatesTitle || 'Check lists';
            const duplicatesTotalLabel = this.dom.duplicatesTotalLabel;
            if (duplicatesTotalLabel) duplicatesTotalLabel.textContent = this.translations.duplicatesTotalLabel || 'Lines:';
            const duplicatesFoundLabel = this.dom.duplicatesFoundLabel;
            if (duplicatesFoundLabel) duplicatesFoundLabel.textContent = this.translations.duplicatesFoundLabel || 'Duplicates:';
            const duplicatesFilesLabel = this.dom.duplicatesFilesLabel;
            if (duplicatesFilesLabel) duplicatesFilesLabel.textContent = this.translations.duplicatesFilesLabel || 'Files:';
            const duplicatesClose = this.dom.duplicatesClose;
            if (duplicatesClose) duplicatesClose.textContent = this.translations.duplicatesClose || 'Close';
            const compareSaveRight = this.dom.compareSaveRightDesktop;
            if (compareSaveRight) compareSaveRight.textContent = this.translations.save || 'Save';
            const compareSaveMobile = this.dom.compareSaveMobile;
            if (compareSaveMobile) compareSaveMobile.textContent = this.translations.save || 'Save';
            const compareCloseDesktop = this.dom.compareCloseDesktop;
            if (compareCloseDesktop) compareCloseDesktop.textContent = this.translations.duplicatesClose || 'Close';
            const compareCloseMobile = this.dom.compareCloseMobile;
            if (compareCloseMobile) compareCloseMobile.textContent = this.translations.duplicatesClose || 'Close';
            const addFileButton = this.dom.addFile;
            if (addFileButton) addFileButton.title = this.translations.createFile;
            const syntaxToggle = this.dom.syntaxToggle;
            if (syntaxToggle) {
                syntaxToggle.title = this.translations.syntaxToggle || 'Switch syntax highlighting';
            }
            const toolsToggle = this.dom.toolsToggle;
            const toolsLabel = this.dom.toolsLabel;
            if (toolsToggle) {
                toolsToggle.title = this.translations.toolsTitle || 'Tools';
            }
            if (toolsLabel) {
                toolsLabel.textContent = this.translations.toolsLabel || 'Tools';
            }
            const versionSwitcher = this.dom.versionSwitcher;
            if (versionSwitcher) {
                versionSwitcher.title = this.translations.switchVersion || 'Select Version';
            }
            const versionSwitcherTextEls = this.dom.versionSwitcherTextEls;
            if (versionSwitcherTextEls) {
                versionSwitcherTextEls.forEach((el) => {
                    el.textContent = this.translations.switchVersion || 'Select Version';
                });
            }
            const switchTitle = this.dom.switchVersionTitle;
            if (switchTitle) {
                switchTitle.textContent = this.translations.switchVersionTitle || 'Switch Version';
            }
            const currentVersionLabel = this.dom.currentVersionLabel;
            if (currentVersionLabel) {
                currentVersionLabel.textContent = this.translations.currentVersion || 'Current Version:';
            }
            const selectVersionLabel = this.dom.selectVersionLabel;
            if (selectVersionLabel) {
                selectVersionLabel.textContent = this.translations.selectVersion || 'Select Version:';
            }
            const switchCancel = this.dom.switchVersionCancel;
            if (switchCancel) {
                switchCancel.textContent = this.translations.cancel || 'Cancel';
            }
            const switchConfirm = this.dom.switchVersionConfirm;
            if (switchConfirm) {
                switchConfirm.textContent = this.translations.switchVersion || 'Select Version';
            }
            this.updateListDuplicateMarkers();
            this.updateStatusTooltip();
            this.updateSyntaxToggleUI();
        },

        // === Theme / Layout ===
        toggleTheme() {
            const root = this.dom.root;
            const theme = root.dataset.theme === THEMES.dark ? THEMES.light : THEMES.dark;
            localStorage.setItem(STORAGE_KEYS.theme, theme);
            root.dataset.theme = theme;
            
            const themeButton = this.dom.theme;
            themeButton.title = theme === THEMES.dark ? this.translations.themeLight : this.translations.themeDark;

            this.updateEditorsTheme(theme);
        },

        updateEditorsTheme(theme) {
            const cmTheme = theme === THEMES.dark ? CM_THEMES.dark : CM_THEMES.light;
            if (this.editor) {
                this.editor.setOption('theme', cmTheme);
            }
            if (this.compareDesktopLeftEditor) {
                this.compareDesktopLeftEditor.setOption('theme', cmTheme);
            }
            if (this.compareDesktopRightEditor) {
                this.compareDesktopRightEditor.setOption('theme', cmTheme);
            }
            if (this.compareMobileEditor) {
                this.compareMobileEditor.setOption('theme', cmTheme);
            }
        },

        getCurrentCodeMirrorTheme() {
            return localStorage.getItem(STORAGE_KEYS.theme) === THEMES.dark
                ? CM_THEMES.dark
                : CM_THEMES.light;
        },

        updateEditorsMode() {
            if (this.currentFilename) {
                this.setEditorModeForFile(this.currentFilename);
            }
            if (this.compareDesktopLeftEditor && this.compareLeftFilename) {
                this.setCompareEditorMode(this.compareDesktopLeftEditor, this.compareLeftFilename);
            }
            if (this.compareDesktopRightEditor && this.compareRightFilename) {
                this.setCompareEditorMode(this.compareDesktopRightEditor, this.compareRightFilename);
            }
            if (this.compareMobileEditor && this.compareActiveSideMobile) {
                const filename = this.compareActiveSideMobile === 'right'
                    ? this.compareRightFilename
                    : this.compareLeftFilename;
                if (filename) {
                    this.setCompareEditorMode(this.compareMobileEditor, filename);
                }
            }
        }
    });
}
