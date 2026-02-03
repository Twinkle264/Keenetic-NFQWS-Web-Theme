import { CLASSNAMES, STORAGE_KEYS } from './constants.js';

export function applyAuth(UI) {
    Object.assign(UI.prototype, {
        async checkAuth() {
            try {
                const response = await this.postData({ cmd: 'filenames' });
                
                if (response && response.status === 0) {
                    await this.handleAuthSuccess(response.service);
                } else if (response && response.status === 401) {
                    this.handleAuthUnauthorized();
                } else {
                    console.error('Auth check error:', response);
                    this.showLoginForm();
                }
            } catch (error) {
                console.error('Auth check error:', error);
                this.showLoginForm();
            }
        },

        initLoginForm() {
            const loginForm = this.dom.loginForm;
            const loginInput = this.dom.loginInput;
            const passwordInput = this.dom.passwordInput;
            const loginButton = this.dom.loginButton;
            const closeButton = loginForm.querySelector('.popup-close-btn');
            const loginTitle = this.dom.loginTitle;
            
            loginTitle.textContent = this.translations.login || 'Login';
            loginButton.textContent = this.translations.login || 'Login';
            
            loginButton.addEventListener('click', async () => {
                const user = loginInput.value.trim();
                const password = passwordInput.value;
                
                if (!user || !password) {
                    this.showError(`${this.translations.error}: ${this.translations.enterLoginPassword}`);
                    return;
                }
                
                try {
                    const result = await this.postData({
                        cmd: 'login',
                        user: user,
                        password: password
                    });
                    
                    if (result && result.status === 0) {
                        await this.handleAuthSuccess(null, { closeLoginForm: true });
                    } else {
                        this.showError(`${this.translations.error}: ${this.translations.loginFailed}`);
                        passwordInput.value = '';
                    }
                } catch (error) {
                    this.showError(`${this.translations.error}: ${this.translations.loginError}`);
                }
            });
            
            // Close button for login form
            closeButton.addEventListener('click', () => {
                this.closePopupSimple(loginForm);
            });
            
            // Enter key для логина
            loginInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    passwordInput.focus();
                }
            });
            
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    loginButton.click();
                }
            });
        },

        async handleAuthSuccess(service, { closeLoginForm = false } = {}) {
            this.setAuthState(true);
            if (closeLoginForm && this.dom.loginForm) {
                this.closePopupSimple(this.dom.loginForm);
            }
            if (service !== null && service !== undefined) {
                this.setStatus(service);
            }
            await this.loadFiles();
        },

        handleAuthUnauthorized() {
            this.setAuthState(false);
            this.showLoginForm();
        },

        setAuthState(isAuthenticated) {
            this.isAuthenticated = isAuthenticated;
            if (isAuthenticated) {
                document.body.classList.add(CLASSNAMES.authenticated);
                localStorage.setItem(STORAGE_KEYS.hasSession, 'true');
            } else {
                localStorage.removeItem(STORAGE_KEYS.hasSession);
                document.body.classList.remove(CLASSNAMES.authenticated);
            }
        }
    });
}
