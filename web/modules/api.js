export function applyApi(UI) {
    Object.assign(UI.prototype, {
        async postData(data) {
            const formData = new FormData();
            for (const [key, value] of Object.entries(data)) {
                formData.append(key, value);
            }

            try {
                const response = await fetch('index.php', {
                    method: 'POST',
                    body: formData,
                });

                if (response.ok) {
                    return await response.json();
                }

                if (response.status === 401) {
                    this.handleAuthUnauthorized();
                    return { status: 401 };
                }
                
                return { status: response.status };
            } catch (e) {
                console.error('API Error:', e);
                return { status: 500 };
            }
        },

        async getFiles() {
            return this.postData({ cmd: 'filenames' });
        },

        async getFileContent(filename) {
            const data = await this.postData({ cmd: 'filecontent', filename });
            return data.content || '';
        },

        async saveFile(filename, content) {
            return this.postData({ cmd: 'filesave', filename, content });
        },

        async removeFile(filename) {
            return this.postData({ cmd: 'fileremove', filename });
        },

        async serviceActionRequest(action) {
            return this.postData({ cmd: action });
        }
    });
}
