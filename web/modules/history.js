export class HistoryManager {
    constructor() {
        this.history = {};
        this.currentFile = '';
        this.maxHistorySize = 100;
    }

    init(editor) {
        this.editor = editor;
        
        // Обработчик изменений для сохранения истории
        this.editor.on('change', (cm, change) => {
            if (this.currentFile) {
                this.addToHistory(change);
            }
        });
    }

    updateCurrentFile(filename) {
        this.currentFile = filename;
        if (!this.history[filename]) {
            this.history[filename] = {
                changes: [],
                currentIndex: -1
            };
        }
    }

    addToHistory(change) {
        if (!this.currentFile) return;
        
        const fileHistory = this.history[this.currentFile];
        
        // Добавляем изменение в историю
        fileHistory.changes = fileHistory.changes.slice(0, fileHistory.currentIndex + 1);
        fileHistory.changes.push(change);
        fileHistory.currentIndex++;
        
        // Ограничиваем размер истории
        if (fileHistory.changes.length > this.maxHistorySize) {
            fileHistory.changes.shift();
            fileHistory.currentIndex--;
        }
    }

    clear() {
        if (this.currentFile && this.history[this.currentFile]) {
            this.history[this.currentFile] = {
                changes: [],
                currentIndex: -1
            };
        }
    }

    canUndo() {
        return this.currentFile && 
               this.history[this.currentFile] && 
               this.history[this.currentFile].currentIndex >= 0;
    }

    canRedo() {
        return this.currentFile && 
               this.history[this.currentFile] && 
               this.history[this.currentFile].currentIndex < this.history[this.currentFile].changes.length - 1;
    }
}
