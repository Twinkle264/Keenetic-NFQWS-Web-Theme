export class KeyboardShortcuts {
    constructor(ui) {
        this.ui = ui;
        this.init();
    }

    init() {
        // Обработчик глобальных горячих клавиш
        document.addEventListener('keydown', (e) => {
            // Ctrl+S или Cmd+S для сохранения
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault(); // Предотвращаем стандартное сохранение страницы
                if (this.ui.isAuthenticated) {
                    this.ui.saveCurrentFile();
                }
                return false;
            }
            
            // Ctrl+Z или Cmd+Z для отмены - позволяем CodeMirror обработать
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                // Разрешаем CodeMirror обработать стандартным образом
                return true;
            }
            
            // Ctrl+Y или Ctrl+Shift+Z для повтора
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                // Разрешаем CodeMirror обработать стандартным образом
                return true;
            }
        });
    }
}
