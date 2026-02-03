import { STORAGE_KEYS, CLASSNAMES, THEMES, CM_THEMES } from './modules/constants.js';
import { HistoryManager } from './modules/history.js';
import { KeyboardShortcuts } from './modules/keyboard.js';
import { applyAvailability } from './modules/availability.js';
import { applyDuplicates } from './modules/duplicates.js';
import { applyCompare } from './modules/compare.js';
import { applyTabs } from './modules/tabs.js';
import { applyFiles } from './modules/files.js';
import { applyCreateFile } from './modules/create-file.js';
import { applyPopups } from './modules/popups.js';
import { applyAuth } from './modules/auth.js';
import { applyApi } from './modules/api.js';
import { applyService } from './modules/service.js';
import { applyI18nTheme } from './modules/i18n-theme.js';
import { applyEditor } from './modules/editor.js';
import { applyNotifications } from './modules/notifications.js';


class UI {
    // === Lifecycle ===
    constructor() {
        this.currentLang = localStorage.getItem(STORAGE_KEYS.lang) || 'en';
        this.translations = {};
        this.editor = null;
        this.originalContent = '';
        this.currentFilename = '';
        this.isAuthenticated = localStorage.getItem(STORAGE_KEYS.hasSession) === 'true';
        this.checkInProgress = false;
        this.listDuplicateMarkers = [];
        this.listDuplicateLineHandles = [];
        this.listDuplicateTimer = null;
        this.historyManager = new HistoryManager();
        this.keyboardShortcuts = new KeyboardShortcuts(this);
        this.protectedFiles = new Set([
            'nfqws.conf',
            'user.list',
            'exclude.list',
            'auto.list',
            'ipset.list',
            'ipset_exclude.list',
            'nfqws.log'
        ]);
        this.syntaxMode = localStorage.getItem(STORAGE_KEYS.syntaxMode) || 'nfqws';
        this.filesSet = new Set();
        this.addButton = null;
        this.dom = {};
        
        this.init();
    }

    // === Bootstrapping ===
    async init() {
        if (!localStorage.getItem(STORAGE_KEYS.theme)) {
            localStorage.setItem(STORAGE_KEYS.theme, THEMES.dark);
        }
        this.cacheDom();
        await this.loadTranslations();
        this.initCodeMirror();
        this.initUIComponents();
        this.applyTranslations();
        
        if (this.isAuthenticated) {
            await this.checkAuth();
        } else {
            this.showLoginForm();
        }
        
        // Инициализируем историю после загрузки редактора
        if (this.editor) {
            this.historyManager.init(this.editor);
        }
    }

    // === i18n ===
    async loadTranslations() {
        try {
            const langBase = window.LANG_BASE || 'lang/';
            const response = await fetch(`${langBase}${this.currentLang}.json`);
            this.translations = await response.json();
        } catch (error) {
            console.error('Error loading translations:', error);
            this.translations = {
                save: "Save",
                restart: "Restart",
                reload: "Reload",
                stop: "Stop",
                start: "Start",
                update: "Update",
                login: "Login",
                logout: "Logout",
                confirmSave: "Save changes?",
                confirmRestart: "Restart service?",
                confirmReload: "Reload service?",
                confirmStop: "Stop service?",
                confirmStart: "Start service?",
                confirmUpdate: "Update nfqws-keenetic?",
                confirmClose: "File has unsaved changes. Close anyway?",
                confirmDelete: "Delete this file?",
                confirmDeleteWithName: "Delete file {filename}?",
                confirmClear: "Clear log file?",
                yes: "Yes",
                no: "No",
                close: "Close",
                cancel: "Cancel",
                confirm: "Confirm",
                createFile: "Create",
                createFileTitle: "Create file",
                createFilePlaceholder: "e.g. my.list",
                fileNameRequired: "Enter a file name",
                fileNameInvalid: "Invalid file name",
                fileNameInvalidDetails: "Only Latin letters, numbers, dot, dash and underscore are allowed",
                fileExtensionRequired: "Add a file extension",
                fileNameReserved: "This file name is protected",
                fileAlreadyExists: "File already exists",
                failedToCreateFile: "Failed to create file",
                deleteFile: "Delete file",
                clearLog: "Clear log",
                enterLoginPassword: "Please enter login and password",
                loginFailed: "Login failed",
                loginError: "Login error",
                fileSaved: "File saved successfully",
                fileDeleted: "File deleted successfully",
                logCleared: "Log cleared successfully",
                serviceRestarted: "Service restarted successfully",
                serviceReloaded: "Service reloaded successfully",
                serviceStopped: "Service stopped successfully",
                serviceStarted: "Service started successfully",
                upgradeCompleted: "Upgrade completed",
                error: "Error",
                success: "Success",
                processing: "Processing...",
                unknownError: "Unknown error",
                failedToLoadFile: "Failed to load file",
                failedToSaveFile: "Failed to save file",
                executingCommand: "Executing: nfqws-keenetic {action}",
                protectedFile: "Protected file",
                confirmDeleteFileType: "Delete file {filename}?",
                statusRunning: "Running",
                statusStopped: "Stopped",
                themeLight: "Switch to light theme",
                themeDark: "Switch to dark theme",
                language: "Language",
                placeholder: "# Configuration file\n# Edit and save...",
                noFileSelected: "No file selected",
                fullscreen: "Toggle fullscreen",
                exitFullscreen: "Exit fullscreen",
                checkAvailability: "Проверить доступность",
                checkingDomains: "Проверка доступности доменов...",
                domainCheckComplete: "Проверка доменов завершена",
                totalDomains: "Всего",
                accessibleDomains: "Доступны",
                blockedDomains: "Заблокированы",
                progress: "Прогресс",
                domainAccessible: "Доступен",
                domainBlocked: "Заблокирован",
                noDomainsFound: "Домены не найдены в файле",
                domainCheckError: "Ошибка проверки доменов",
                selectListFile: "Выберите файл .list для проверки доменов",
                checkingInProgress: "Проверка...",
                checkingDomain: "Проверка {domain}...",
                checkLists: "Check lists",
                duplicatesTitle: "Check lists",
                duplicatesTotalLabel: "Lines:",
                duplicatesFoundLabel: "Duplicates:",
                duplicatesFilesLabel: "Files:",
                duplicatesNone: "No duplicates found",
                duplicatesCurrentLine: "Current line",
                duplicatesLineLabel: "line",
                toolsLabel: "Tools",
                toolsTitle: "Tools",
                syntaxCustom: "NFQWS",
                syntaxShell: "Shell",
                syntaxToggle: "Switch syntax highlighting"
            };
        }
    }

    // === UI Wiring ===
    initUIComponents() {
        this.initNavWheelScroll();
        this.initButtons();
        this.tabs = this.initTabs();
        this.initAddFileButton();
        this.initPopups();
        this.initOverlayDismiss();
        this.initCreateFilePopup();
        this.initLanguageSwitcher();
        this.initThemeSwitcher();
        this.initToolsLinks();
        this.initLoginForm();
        this.initDuplicatesPopup();
        this.initComparePopup();
        this.initAvailabilityPopup();
    }

    cacheDom() {
        const byId = (id) => document.getElementById(id);
        this.dom = {
            root: document.documentElement,
            tabs: document.querySelector('nav'),
            editorContainer: document.querySelector('.editor-container'),
            save: byId('save'),
            restart: byId('restart'),
            dropdown: byId('dropdown'),
            dropdownMenu: byId('dropdown-menu'),
            reload: byId('reload'),
            stop: byId('stop'),
            start: byId('start'),
            upgrade: byId('upgrade'),
            logout: byId('logout'),
            editorFullscreen: byId('editor-fullscreen'),
            saveFullscreen: byId('save-fullscreen'),
            checkAvailability: byId('check-availability'),
            checkAvailabilityText: byId('check-availability-text'),
            checkList: byId('check-list'),
            checkListText: byId('check-list-text'),
            toolsToggle: byId('tools-toggle'),
            toolsMenu: byId('tools-menu'),
            addFile: byId('add-file'),
            loginForm: byId('login-form'),
            loginInput: byId('login'),
            passwordInput: byId('password'),
            loginButton: byId('login-button'),
            loginTitle: byId('login-title'),
            createFilePopup: byId('create-file'),
            createFileTitle: byId('create-file-title'),
            createFileName: byId('create-file-name'),
            createFileConfirm: byId('create-file-confirm'),
            createFileCancel: byId('create-file-cancel'),
            createFileClose: byId('create-file-close'),
            currentFilename: byId('current-filename'),
            config: byId('config'),
            saveText: byId('save-text'),
            restartText: byId('restart-text'),
            reloadText: byId('reload-text'),
            stopText: byId('stop-text'),
            startText: byId('start-text'),
            updateText: byId('update-text'),
            saveFsText: byId('save-fs-text'),
            popupYes: byId('popup-yes'),
            popupNo: byId('popup-no'),
            popupClose: byId('popup-close'),
            popupTitle: byId('popup-title'),
            popupContent: byId('popup-content'),
            alertPopup: byId('alert'),
            availabilityPopup: byId('availability-results'),
            availabilityTitle: byId('availability-title'),
            availabilityClose: byId('availability-close'),
            totalDomains: byId('total-domains'),
            accessibleDomains: byId('accessible-domains'),
            blockedDomains: byId('blocked-domains'),
            progress: byId('progress'),
            progressBar: byId('progress-bar'),
            domainsList: byId('domains-list'),
            totalLabel: document.querySelector('[data-label="total"]'),
            accessibleLabel: document.querySelector('[data-label="accessible"]'),
            blockedLabel: document.querySelector('[data-label="blocked"]'),
            progressLabel: document.querySelector('[data-label="progress"]'),
            languageOptions: document.querySelectorAll('.language-option'),
            duplicatesPopup: byId('duplicates-results'),
            duplicatesTitle: byId('duplicates-title'),
            duplicatesTotalLabel: byId('duplicates-total-label'),
            duplicatesFoundLabel: byId('duplicates-found-label'),
            duplicatesFilesLabel: byId('duplicates-files-label'),
            duplicatesClose: byId('duplicates-close'),
            duplicatesCloseBtn: byId('duplicates-close-btn'),
            duplicatesTotal: byId('duplicates-total'),
            duplicatesFound: byId('duplicates-found'),
            duplicatesFiles: byId('duplicates-files'),
            duplicatesList: byId('duplicates-list'),
            comparePopup: byId('compare-results'),
            compareCloseDesktop: byId('compare-close-desktop'),
            compareCloseMobile: byId('compare-close-mobile'),
            compareSaveRightDesktop: byId('compare-save-right-desktop'),
            compareSaveMobile: byId('compare-save-mobile'),
            compareLeftNameDesktop: byId('compare-left-name-desktop'),
            compareRightNameDesktop: byId('compare-right-name-desktop'),
            compareLeftNameMobile: byId('compare-left-name-mobile'),
            compareRightNameMobile: byId('compare-right-name-mobile'),
            compareLeftContentDesktop: byId('compare-left-content-desktop'),
            compareRightContentDesktop: byId('compare-right-content-desktop'),
            compareContentMobile: byId('compare-content-mobile'),
            theme: byId('theme'),
            languageSwitcher: byId('language-switcher'),
            syntaxToggle: byId('syntax-toggle'),
            syntaxText: byId('syntax-text'),
            toolsLabel: byId('tools-label'),
            routerLink: byId('router-link'),
            overlay: byId('overlay'),
            statusDot: byId('status'),
            version: byId('version')
        };
    }

    // === Navigation ===
    initNavWheelScroll() {
        if (!this.dom.tabs) return;
        this.dom.tabs.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
            e.preventDefault();
            this.dom.tabs.scrollLeft += e.deltaY;
        }, { passive: false });
    }

    initButtons() {
        // Save button
        this.dom.save.addEventListener('click', () => this.saveCurrentFile());
        
        // Check Availability button
        this.dom.checkAvailability.addEventListener('click', () => this.checkDomainsAvailability());
        const checkListButton = this.dom.checkList;
        if (checkListButton) {
            checkListButton.addEventListener('click', () => this.checkListDuplicates());
        }
        
        // Restart button
        this.dom.restart.addEventListener('click', () => this.confirmServiceAction('restart'));
        
        // Dropdown button
        this.dom.dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.isAuthenticated) return;
            this.toggleMenu(this.dom.dropdownMenu);
        });
        
        // Dropdown items
        this.dom.reload.addEventListener('click', () => {
            this.hideMenu(this.dom.dropdownMenu);
            this.confirmServiceAction('reload');
        });
        
        this.dom.stop.addEventListener('click', () => {
            this.hideMenu(this.dom.dropdownMenu);
            this.confirmServiceAction('stop');
        });
        
        this.dom.start.addEventListener('click', () => {
            this.hideMenu(this.dom.dropdownMenu);
            this.confirmServiceAction('start');
        });
        
        this.dom.upgrade.addEventListener('click', () => {
            this.hideMenu(this.dom.dropdownMenu);
            this.confirmServiceAction('upgrade');
        });

        // Syntax toggle
        const syntaxToggle = this.dom.syntaxToggle;
        if (syntaxToggle) {
            syntaxToggle.addEventListener('click', () => {
                this.hideMenu(this.dom.dropdownMenu);
                this.syntaxMode = this.syntaxMode === 'nfqws' ? 'shell' : 'nfqws';
                localStorage.setItem(STORAGE_KEYS.syntaxMode, this.syntaxMode);
                this.updateSyntaxToggleUI();
                this.updateEditorsMode();
            });
        }

        // Tools dropdown
        const toolsToggle = this.dom.toolsToggle;
        const toolsMenu = this.dom.toolsMenu;
        if (toolsToggle && toolsMenu) {
            toolsToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hideMenu(this.dom.dropdownMenu);
                this.toggleMenu(toolsMenu);
            });

            toolsMenu.addEventListener('click', () => {
                this.hideMenu(toolsMenu);
            });
        }
        
        // Logout button
        this.dom.logout.addEventListener('click', async () => {
            const result = await this.postData({ cmd: 'logout' });
            if (result && result.status === 0) {
                localStorage.removeItem(STORAGE_KEYS.hasSession);
                window.location.reload();
            }
        });
        
        // Fullscreen button
        this.dom.editorFullscreen.addEventListener('click', () => this.toggleFullscreen());
        
        // Save button in fullscreen
        this.dom.saveFullscreen.addEventListener('click', () => this.saveCurrentFile());
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = this.dom.dropdownMenu;
            const dropdownBtn = this.dom.dropdown;
            const toolsToggleEl = this.dom.toolsToggle;
            const toolsMenuEl = this.dom.toolsMenu;
            
            this.hideMenuOnOutsideClick(dropdown, dropdownBtn, e.target);
            this.hideMenuOnOutsideClick(toolsMenuEl, toolsToggleEl, e.target);
        });
    }

    toggleMenu(menuEl) {
        if (!menuEl) return;
        menuEl.classList.toggle(CLASSNAMES.hidden);
    }

    hideMenu(menuEl) {
        if (!menuEl) return;
        menuEl.classList.add(CLASSNAMES.hidden);
    }

    hideMenuOnOutsideClick(menuEl, toggleEl, target) {
        if (!menuEl || !toggleEl) return;
        if (!menuEl.classList.contains(CLASSNAMES.hidden) &&
            !menuEl.contains(target) &&
            !toggleEl.contains(target)) {
            menuEl.classList.add(CLASSNAMES.hidden);
        }
    }

    // === File Helpers ===
    async confirmDiscardChanges() {
        if (!document.body.classList.contains(CLASSNAMES.changed)) return true;
        return await this.showConfirm(
            this.translations.confirmClose,
            this.translations.confirm
        );
    }

    async saveCurrentFile() {
        if (!this.isAuthenticated) return;
        
        const filename = this.tabs.currentFileName;
        if (!filename) return;

        try {
            const content = this.editor.getValue();
            const saved = await this.saveFileAndNotify(filename, content, {
                successMessage: this.translations.fileSaved || 'Saved',
                errorMessage: this.translations.failedToSaveFile
            });
            if (saved) {
                this.markEditorClean(content);
                if (this.historyManager) {
                    this.historyManager.updateCurrentFile(filename);
                }
            }
        } catch (error) {
            console.error('Error saving file:', error);
            this.showError(`${this.translations.error}: ${this.translations.failedToSaveFile}`);
        }
    }

    resetHistoryForFile(filename) {
        if (!this.historyManager) return;
        this.historyManager.clear();
        this.historyManager.updateCurrentFile(filename);
    }

    updateListCheckButton() {
        const checkListButton = this.dom.checkList;
        const checkAvailabilityButton = this.dom.checkAvailability;
        if (!checkListButton && !checkAvailabilityButton) return;
        const shouldHide = !this.isListFile(this.currentFilename);
        if (checkListButton) {
            checkListButton.classList.toggle(CLASSNAMES.hidden, shouldHide);
        }
        if (checkAvailabilityButton) {
            checkAvailabilityButton.classList.toggle(CLASSNAMES.hidden, shouldHide);
        }
    }

    updateCurrentFilenameDisplay(filename) {
        if (!this.dom.currentFilename) return;
        this.dom.currentFilename.textContent = filename || this.translations.noFileSelected;
    }

    isConfigFile(filename) {
        return !!filename && (filename.includes('.conf') || filename.includes('.conf-'));
    }

    isLogFile(filename) {
        return !!filename && filename.endsWith('.log');
    }

    isListFile(filename) {
        return !!filename && (filename.endsWith('.list') || filename.includes('.list-'));
    }

    ensureListFileSelected(filename, errorMessage) {
        if (this.isListFile(filename)) return true;
        this.showError(errorMessage);
        return false;
    }

    // === Footer Links ===
    initToolsLinks() {
        const routerLink = this.dom.routerLink;
        if (!routerLink) return;
        const { protocol, hostname } = window.location;
        routerLink.href = `${protocol}//${hostname}`;
    }

}

applyAvailability(UI);
applyDuplicates(UI);
applyCompare(UI);
applyTabs(UI);
applyFiles(UI);
applyCreateFile(UI);
applyPopups(UI);
applyAuth(UI);
applyApi(UI);
applyService(UI);
applyI18nTheme(UI);
applyEditor(UI);
applyNotifications(UI);

// Start the UI
document.addEventListener('DOMContentLoaded', () => {
    window.ui = new UI();
});
