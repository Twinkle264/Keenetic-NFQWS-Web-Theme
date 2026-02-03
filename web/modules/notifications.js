export function applyNotifications(UI) {
    Object.assign(UI.prototype, {
        // === Notifications ===
        showNotification(message, type = 'success') {
            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            notification.textContent = message;
            
            // Уведомления всегда показываются справа
            notification.style.cssText = `
                position: fixed;
                top: 96px;
                right: 30px;
                padding: 12px 20px;
                background: ${type === 'success' ? '#34c759' : '#ff3b30'};
                color: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 99999999;
                animation: slideIn 0.3s ease;
                max-width: 300px;
                word-break: break-word;
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        },

        showSuccess(message) {
            if (!message) return;
            this.showNotification(message, 'success');
        },

        showError(message) {
            if (!message) return;
            this.showNotification(message, 'error');
        }
    });
}
