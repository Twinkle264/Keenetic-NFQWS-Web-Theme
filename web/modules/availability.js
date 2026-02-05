export function applyAvailability(UI) {
    Object.assign(UI.prototype, {
        async checkDomainsAvailability() {
            if (!this.isAuthenticated || this.checkInProgress) return;

            const filename = this.tabs.currentFileName;
            if (!this.ensureListFileSelected(filename, this.translations.selectListFile || 'Выберите файл .list для проверки доменов')) {
                return;
            }

            this.checkInProgress = true;
            this.availabilityCancelled = false;

            try {
                const content = this.editor.getValue();
                const domains = this.extractDomainsFromContent(content);

                if (domains.length === 0) {
                    this.showError(this.translations.noDomainsFound || 'Домены не найдены в файле');
                    this.checkInProgress = false;
                    return;
                }

                this.currentDomains = domains;
                this.showAvailabilityPopup(domains);
                await this.checkDomains(domains);
            } catch (error) {
                console.error('Error checking domains:', error);
                this.showError(`${this.translations.domainCheckError}: ${error.message}`);
                this.checkInProgress = false;
            }
        },

        async retryDomainCheck() {
            if (!this.isAuthenticated || this.checkInProgress || !this.currentDomains?.length) return;

            this.checkInProgress = true;
            this.availabilityCancelled = false;
            const availabilityTitle = this.dom.availabilityTitle;
            if (availabilityTitle) {
                availabilityTitle.textContent = this.translations.retryCheckingDomains || 'Повторная проверка доступности доменов...';
            }

            try {
                await this.checkDomains(this.currentDomains);
            } catch (error) {
                console.error('Error retrying domain check:', error);
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
            this.availabilityCancelled = false;
            this.availabilityAbortControllers = new Set();
            this.availabilityPendingIframes = new Set();
            this.availabilityPendingImages = new Set();

            const total = domains.length;
            let checked = 0;
            let accessible = 0;
            let blocked = 0;

            const checkButton = this.dom.checkAvailability;
            const checkButtonText = this.dom.checkAvailabilityText;
            const retryButton = this.dom.availabilityRetry;
            const originalText = this.setButtonLoading(
                checkButton,
                checkButtonText,
                `⏳ ${this.translations.checkingInProgress}`
            );
            if (retryButton) {
                retryButton.disabled = true;
                retryButton.classList.add('disabled');
            }

            const checkPromises = domains.map(async (domain) => {
                try {
                    if (this.availabilityCancelled) return { domain, accessible: false, cancelled: true };
                    const isAccessible = await this.checkSingleDomain(domain);
                    if (this.availabilityCancelled) return { domain, accessible: false, cancelled: true };
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
                    if (this.availabilityCancelled) return { domain, accessible: false, cancelled: true };
                    checked++;
                    blocked++;
                    this.updateAvailabilityUI(domain, false, checked, total, accessible, blocked);
                    return { domain, accessible: false, error: error.message };
                }
            });

            try {
                for (let i = 0; i < checkPromises.length; i += 10) {
                    const batch = checkPromises.slice(i, i + 10);
                    await Promise.allSettled(batch);
                    if (this.availabilityCancelled) break;
                }

                if (!this.availabilityCancelled) {
                    this.finalizeAvailabilityCheck(accessible, blocked);
                }
            } catch (error) {
                console.error('Domain check error:', error);
            } finally {
                this.checkInProgress = false;
                this.restoreButton(checkButton, checkButtonText, originalText);
                if (retryButton) {
                    retryButton.disabled = false;
                    retryButton.classList.remove('disabled');
                }
                this.clearAvailabilityPending();
            }
        },

        async checkSingleDomain(domain) {
            const methods = [
                this.checkWithFetch.bind(this, domain),
                this.checkWithImage.bind(this, domain),
                this.checkWithIframe.bind(this, domain)
            ];

            for (const method of methods) {
                if (this.availabilityCancelled) return false;
                try {
                    const result = await Promise.race([
                        method(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
                    ]);
                    if (result) return true;
                } catch (error) {
                    continue;
                }
            }

            return false;
        },

        async checkWithFetch(domain) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1500);
                this.availabilityAbortControllers?.add(controller);

                await fetch(`https://${domain}`, {
                    method: 'HEAD',
                    mode: 'no-cors',
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                clearTimeout(timeoutId);
                this.availabilityAbortControllers?.delete(controller);
                return true;
            } catch (error) {
                if (error?.name === 'AbortError' && this.availabilityCancelled) {
                    throw error;
                }
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 1500);
                    this.availabilityAbortControllers?.add(controller);

                    await fetch(`http://${domain}`, {
                        method: 'HEAD',
                        mode: 'no-cors',
                        signal: controller.signal,
                        headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                    clearTimeout(timeoutId);
                    this.availabilityAbortControllers?.delete(controller);
                    return true;
                } catch (httpError) {
                    throw error;
                }
            }
        },

        async checkWithImage(domain) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                const timeout = 1500;
                if (!this.availabilityPendingImages) {
                    this.availabilityPendingImages = new Set();
                }
                this.availabilityPendingImages.add(img);

                const timeoutId = setTimeout(() => {
                    img.onerror = null;
                    img.onload = null;
                    this.availabilityPendingImages?.delete(img);
                    reject(new Error('Таймаут'));
                }, timeout);

                img.onload = () => {
                    clearTimeout(timeoutId);
                    this.availabilityPendingImages?.delete(img);
                    resolve(true);
                };

                img.onerror = () => {
                    clearTimeout(timeoutId);
                    this.availabilityPendingImages?.delete(img);
                    reject(new Error('Изображение не загрузилось'));
                };

                img.src = `https://${domain}/favicon.ico?t=${Date.now()}`;
            });
        },

        async checkWithIframe(domain) {
            return new Promise((resolve, reject) => {
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                if (!this.availabilityPendingIframes) {
                    this.availabilityPendingIframes = new Set();
                }
                this.availabilityPendingIframes.add(iframe);

                const timeoutId = setTimeout(() => {
                    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
                    this.availabilityPendingIframes?.delete(iframe);
                    reject(new Error('Timeout'));
                }, 1500);

                iframe.onload = () => {
                    clearTimeout(timeoutId);
                    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
                    this.availabilityPendingIframes?.delete(iframe);
                    resolve(true);
                };

                iframe.onerror = () => {
                    clearTimeout(timeoutId);
                    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
                    this.availabilityPendingIframes?.delete(iframe);
                    reject(new Error('Iframe error'));
                };

                iframe.src = `https://${domain}`;
                document.body.appendChild(iframe);
            });
        },

        updateAvailabilityUI(domain, isAccessible, checked, total, accessible, blocked) {
            if (this.availabilityCancelled) return;
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

        resetAvailabilityState() {
            this.checkInProgress = false;
            const checkButton = this.dom.checkAvailability;
            const checkButtonText = this.dom.checkAvailabilityText;
            if (checkButton) {
                checkButton.disabled = false;
                checkButton.classList.remove('disabled');
            }
            if (checkButtonText) {
                checkButtonText.textContent = this.translations.checkAvailability || 'Проверить доступность';
            }
            const retryButton = this.dom.availabilityRetry;
            if (retryButton) {
                retryButton.disabled = false;
                retryButton.classList.remove('disabled');
            }
            const cancelButton = this.dom.availabilityCancel;
            if (cancelButton) {
                cancelButton.disabled = false;
                cancelButton.classList.remove('disabled');
            }
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
            const message = this.translations.domainCheckCompleted
                ? this.translations.domainCheckCompleted
                    .replace('{accessible}', accessible)
                    .replace('{blocked}', blocked)
                : `${this.translations.domainCheckComplete || 'Проверка доменов завершена'}: ${accessible} доступны, ${blocked} заблокированы`;

            this.showSuccess(message);
            this.dom.availabilityTitle.textContent = `${this.translations.domainCheckComplete || 'Проверка доменов завершена'}`;
        },

        clearAvailabilityPending() {
            if (this.availabilityAbortControllers) {
                this.availabilityAbortControllers.forEach(controller => controller.abort());
                this.availabilityAbortControllers.clear();
            }
            if (this.availabilityPendingIframes) {
                this.availabilityPendingIframes.forEach(iframe => {
                    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
                });
                this.availabilityPendingIframes.clear();
            }
            if (this.availabilityPendingImages) {
                this.availabilityPendingImages.forEach(img => {
                    img.onload = null;
                    img.onerror = null;
                    img.src = '';
                });
                this.availabilityPendingImages.clear();
            }
        },

        cancelAvailabilityCheck() {
            if (!this.checkInProgress) return;
            this.availabilityCancelled = true;
            this.clearAvailabilityPending();
            this.checkInProgress = false;
            const availabilityTitle = this.dom.availabilityTitle;
            if (availabilityTitle) {
                availabilityTitle.textContent = this.translations.domainCheckComplete || 'Проверка доменов завершена';
            }
            this.resetAvailabilityState();
        }
    });
}
