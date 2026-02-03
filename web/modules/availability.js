export function applyAvailability(UI) {
    Object.assign(UI.prototype, {
        async checkDomainsAvailability() {
            if (!this.isAuthenticated || this.checkInProgress) return;

            const filename = this.tabs.currentFileName;
            if (!this.ensureListFileSelected(filename, this.translations.selectListFile || 'Выберите файл .list для проверки доменов')) {
                return;
            }

            this.checkInProgress = true;

            try {
                const content = this.editor.getValue();
                const domains = this.extractDomainsFromContent(content);

                if (domains.length === 0) {
                    this.showError(this.translations.noDomainsFound || 'Домены не найдены в файле');
                    this.checkInProgress = false;
                    return;
                }

                this.showAvailabilityPopup(domains);
                await this.checkDomains(domains);
            } catch (error) {
                console.error('Error checking domains:', error);
                this.showError(`${this.translations.domainCheckError}: ${error.message}`);
                this.checkInProgress = false;
            }
        },

        extractDomainsFromContent(content) {
            const lines = content.split('\n');
            const domains = new Set();

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
                    continue;
                }

                let domain = trimmedLine;
                domain = domain.replace(/^(https?:\/\/)/, '');
                domain = domain.replace(/^www\./, '');
                domain = domain.split('#')[0].trim();
                domain = domain.split('/')[0];
                domain = domain.split(':')[0];
                domain = domain.trim();

                if (domain && /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
                    domains.add(domain);
                }
            }

            return Array.from(domains);
        },

        showAvailabilityPopup(domains) {
            const popup = this.dom.availabilityPopup;
            const title = this.dom.availabilityTitle;
            const totalDomains = this.dom.totalDomains;
            const accessibleDomains = this.dom.accessibleDomains;
            const blockedDomains = this.dom.blockedDomains;
            const progress = this.dom.progress;
            const progressBar = this.dom.progressBar;
            const domainsList = this.dom.domainsList;

            this.resetAvailabilityUI({
                title,
                totalDomains,
                accessibleDomains,
                blockedDomains,
                progress,
                progressBar,
                domainsList,
                totalCount: domains.length
            });

            domains.forEach(domain => {
                const domainItem = this.createDomainItem(domain);
                domainsList.appendChild(domainItem);
                this.domainItems.set(domain, domainItem);
            });

            this.openPopup(popup);
        },

        async checkDomains(domains) {
            const total = domains.length;
            let checked = 0;
            let accessible = 0;
            let blocked = 0;

            const checkButton = this.dom.checkAvailability;
            const checkButtonText = this.dom.checkAvailabilityText;
            const originalText = this.setButtonLoading(
                checkButton,
                checkButtonText,
                `⏳ ${this.translations.checkingInProgress}`
            );

            const checkPromises = domains.map(async (domain) => {
                try {
                    const isAccessible = await this.checkDomainAccessibility(domain);
                    checked++;
                    if (isAccessible) {
                        accessible++;
                    } else {
                        blocked++;
                    }
                    this.updateAvailabilityUI(domain, isAccessible, checked, total, accessible, blocked);
                    await new Promise(resolve => setTimeout(resolve, 50));
                    return { domain, accessible: isAccessible };
                } catch (error) {
                    checked++;
                    blocked++;
                    this.updateAvailabilityUI(domain, false, checked, total, accessible, blocked);
                    return { domain, accessible: false, error: error.message };
                }
            });

            try {
                const batchSize = 10;
                for (let i = 0; i < checkPromises.length; i += batchSize) {
                    const batch = checkPromises.slice(i, i + batchSize);
                    await Promise.all(batch);
                }

                this.finalizeAvailabilityCheck(accessible, blocked);
            } catch (error) {
                console.error('Domain check error:', error);
            } finally {
                this.checkInProgress = false;
                this.restoreButton(checkButton, checkButtonText, originalText);
            }
        },

        async checkDomainAccessibility(domain) {
            return new Promise((resolve, reject) => {
                const timeout = 3000;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => {
                    controller.abort();
                    reject(new Error('Таймаут'));
                }, timeout);

                fetch(`https://${domain}`, {
                    method: 'HEAD',
                    mode: 'no-cors',
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                })
                .then(() => {
                    clearTimeout(timeoutId);
                    resolve(true);
                })
                .catch(() => {
                    clearTimeout(timeoutId);
                    this.checkWithImage(domain).then(resolve).catch(() => {
                        this.checkWithHttp(domain).then(resolve).catch(() => resolve(false));
                    });
                });
            });
        },

        async checkWithImage(domain) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                const timeout = 2000;

                const timeoutId = setTimeout(() => {
                    img.onerror = null;
                    img.onload = null;
                    reject(new Error('Таймаут'));
                }, timeout);

                img.onload = () => {
                    clearTimeout(timeoutId);
                    resolve(true);
                };

                img.onerror = () => {
                    clearTimeout(timeoutId);
                    reject(new Error('Изображение не загрузилось'));
                };

                img.src = `https://${domain}/favicon.ico?t=${Date.now()}`;
            });
        },

        async checkWithHttp(domain) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                const timeout = 2000;

                xhr.timeout = timeout;
                xhr.onreadystatechange = () => {
                    if (xhr.readyState === 4) {
                        resolve(true);
                    }
                };

                xhr.ontimeout = () => {
                    reject(new Error('Таймаут'));
                };

                xhr.onerror = () => {
                    reject(new Error('Ошибка сети'));
                };

                xhr.open('HEAD', `http://${domain}`, true);
                xhr.send();
            });
        },

        updateAvailabilityUI(domain, isAccessible, checked, total, accessible, blocked) {
            this.dom.totalDomains.textContent = total;
            this.dom.accessibleDomains.textContent = accessible;
            this.dom.blockedDomains.textContent = blocked;

            const progressPercent = Math.round((checked / total) * 100);
            this.dom.progress.textContent = `${progressPercent}%`;
            this.dom.progressBar.style.width = `${progressPercent}%`;

            const domainItem = this.domainItems ? this.domainItems.get(domain) : null;
            if (domainItem) {
                domainItem.className = isAccessible ? 'domain-item accessible' : 'domain-item blocked';
                domainItem.innerHTML = `
                    <span class="domain-name">${domain}</span>
                    <span class="domain-status">${isAccessible ?
                        (this.translations.domainAccessible || 'Доступен') :
                        (this.translations.domainBlocked || 'Заблокирован')}</span>
                `;
            }
        },

        resetAvailabilityUI({ title, totalDomains, accessibleDomains, blockedDomains, progress, progressBar, domainsList, totalCount }) {
            title.textContent = this.translations.checkingDomains || 'Проверка доступности доменов...';
            totalDomains.textContent = totalCount;
            accessibleDomains.textContent = '0';
            blockedDomains.textContent = '0';
            progress.textContent = '0%';
            progressBar.style.width = '0%';
            domainsList.innerHTML = '';
            this.domainItems = new Map();
        },

        createDomainItem(domain) {
            const domainItem = document.createElement('div');
            domainItem.className = 'domain-item pending';
            domainItem.dataset.domain = domain;
            domainItem.innerHTML = `
                <span class="domain-name">${domain}</span>
                <span class="domain-status">⏳ ${this.translations.checkingDomain?.replace('{domain}', '') || 'Проверка...'}</span>
            `;
            return domainItem;
        },

        finalizeAvailabilityCheck(accessible, blocked) {
            this.showSuccess(`${this.translations.domainCheckComplete || 'Проверка доменов завершена'}: ${accessible} доступны, ${blocked} заблокированы`);
            this.dom.availabilityTitle.textContent = `${this.translations.domainCheckComplete || 'Проверка доменов завершена'}`;
        }
    });
}
