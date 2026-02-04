import { CLASSNAMES } from './constants.js';

export function applyService(UI) {
    Object.assign(UI.prototype, {
        async confirmServiceAction(action) {
            if (!this.isAuthenticated) return;
            
            const confirmTexts = {
                'restart': this.translations.confirmRestart,
                'reload': this.translations.confirmReload,
                'stop': this.translations.confirmStop,
                'start': this.translations.confirmStart,
                'upgrade': this.translations.confirmUpdate
            };

            const successMessages = {
                'restart': this.translations.serviceRestarted,
                'reload': this.translations.serviceReloaded,
                'stop': this.translations.serviceStopped,
                'start': this.translations.serviceStarted,
                'upgrade': this.translations.upgradeCompleted
            };

            const confirmText = this.formatServiceText(confirmTexts[action]);
            if (!confirmText) return;

            const confirmResult = await this.showConfirm(
                confirmText,
                this.translations.confirm
            );
            if (!confirmResult) return;

            const successResult = await this.showProcessing(
                this.formatServiceText(this.translations.executingCommand).replace('{action}', action),
                () => this.serviceActionRequest(action),
                this.translations.processing
            );

            if (successResult) {
                if (action === 'stop') {
                    this.setStatus(false);
                } else if (action === 'start' || action === 'restart') {
                    this.setStatus(true);
                }
                
                const successMessage = successMessages[action];
                if (successMessage) {
                    this.showSuccess(successMessage);
                }
                
                if (action === 'upgrade') {
                    // Обновляем версию в футере
                    const result = await this.postData({ cmd: 'getversion' });
                    if (result && result.status === 0 && result.version) {
                        this.version?.setCurrent?.(`v${result.version}`, result.nfqws2);
                    }
                    
                    setTimeout(() => window.location.reload(), 2000);
                }
            }
        },

        setStatus(status) {
            document.body.classList.toggle(CLASSNAMES.running, status);
            this.updateStatusTooltip();
        },

        updateStatusTooltip() {
            const statusDot = this.dom.statusDot;
            if (!statusDot) return;
            const isRunning = document.body.classList.contains(CLASSNAMES.running);
            statusDot.title = isRunning ? (this.translations.statusRunning || 'Running') : (this.translations.statusStopped || 'Stopped');
        }
    });
}
