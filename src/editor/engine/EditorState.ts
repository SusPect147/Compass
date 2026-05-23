/**
 * EditorState — централизованное хранилище всех флагов и настроек редактора.
 *
 * Вместо ~40 разрозненных полей прямо в `this` MapEditor,
 * состояние логически сгруппировано здесь.
 *
 * Обратная совместимость: MapEditor по-прежнему держит алиасы
 * (this.isErasing и т.д.) через Object.defineProperty геттеры,
 * поэтому весь существующий код в engine-миксинах работает без изменений.
 */
export interface EditorState {
    // ── Инструменты ──────────────────────────────────────────────────
    /** Активен ли режим стирания */
    isErasing: boolean;
    /** Активен ли режим ручного перемещения карты (pan) */
    viewPanActive: boolean;
    /** Текущий режим выделения */
    selectionMode: 'single' | 'line' | 'rectangle' | 'fill' | 'select';
    /** Активен ли режим замены тайла */
    replaceMode: boolean;
    /** Активен ли режим перерисовки тайла */
    overwriteMode: boolean;

    // ── Зеркальность ──────────────────────────────────────────────────
    mirrorVertical: boolean;
    mirrorHorizontal: boolean;
    mirrorDiagonal: boolean;
    /** Умная симметрия — постоянно включена */
    smartSymmetry: boolean;

    // ── UI флаги ──────────────────────────────────────────────────────
    showErrors: boolean;
    showGuides: boolean;

    // ── Перетаскивание ────────────────────────────────────────────────
    isDragging: boolean;
    isDrawing: boolean;
    mouseDown: boolean;
    isSelectDragging: boolean;

    // ── Рендер ────────────────────────────────────────────────────────
    /** Ожидает ли отрисовка следующего RAF-кадра */
    _drawPending: boolean;
    /** Нужно ли пересчитать ошибки перед следующей отрисовкой */
    _errorsDirty: boolean;
}

/**
 * Создаёт объект состояния редактора со значениями по умолчанию.
 */
export function createDefaultEditorState(): EditorState {
    return {
        isErasing:        false,
        viewPanActive:    false,
        selectionMode:    'single',
        replaceMode:      false,
        overwriteMode:    false,

        mirrorVertical:   false,
        mirrorHorizontal: false,
        mirrorDiagonal:   false,
        smartSymmetry:    true,

        showErrors:  false,
        showGuides:  false,

        isDragging:       false,
        isDrawing:        false,
        mouseDown:        false,
        isSelectDragging: false,

        _drawPending: false,
        _errorsDirty: true,
    };
}
