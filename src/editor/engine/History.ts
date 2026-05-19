/**
 * HistoryMixin — дельта-история изменений карты (Undo / Redo).
 *
 * Отличие от предыдущей версии:
 * Старый подход сохранял полную глубокую копию всего tileGrid при каждом действии.
 * Для карты Showdown (60×60 × 5 слоёв = 18 000 ячеек × 50 шагов) это ~900 000 чисел в памяти.
 *
 * Новый подход — дельта-запись:
 * Сохраняется только список изменённых ячеек {layer, x, y, from, to}.
 * Undo просто применяет значения `from`, redo — `to`.
 * Для типичного действия (размещение 1-4 тайлов с зеркалом) — 2-4 объекта вместо 18 000.
 */

/** Одна изменённая ячейка тайлгрида */
interface TileDelta {
    layer: number;
    x: number;
    y: number;
    /** Значение ДО действия */
    from: number;
    /** Значение ПОСЛЕ действия */
    to: number;
}

/** Одна запись в истории — набор изменений за одну атомарную операцию */
interface HistoryEntry {
    deltas: TileDelta[];
    timestamp: number;
}

export const HistoryMixin = {

    /**
     * Начать захват изменений для нового действия истории.
     * Вызывается ПЕРЕД модификацией tileGrid.
     * Сохраняет снапшот затронутых ячеек до изменения.
     *
     * Если нужно сохранить целый блок изменений атомарно:
     * 1. saveState() — делает полный снапшот (legacy, совместимость)
     * 2. beginCapture() / commitCapture() — дельта-подход (новый API)
     */
    saveState(this: any) {
        // Дельта-режим: если идёт транзакция — игнорируем вложенные saveState
        if (this._capturingHistory) return;

        // Legacy-совместимый режим: сохраняем полную копию
        // (используется там, где ещё не перешли на beginCapture/commitCapture)
        const entry: HistoryEntry = {
            deltas: this._buildFullSnapshotDeltas(),
            timestamp: Date.now(),
        };

        this._pushHistoryEntry(entry);
    },

    /**
     * Начать транзакцию дельта-захвата.
     * После вызова все изменения tileGrid отслеживаются автоматически.
     * Завершить транзакцию: commitCapture().
     */
    beginCapture(this: any) {
        if (this._capturingHistory) return; // Уже в транзакции
        this._capturingHistory = true;
        this._captureSnapshot = this.cloneLayeredMap(); // Снапшот ДО
    },

    /**
     * Завершить транзакцию и сохранить дельту в стек истории.
     * Если ничего не изменилось — запись не создаётся.
     */
    commitCapture(this: any) {
        if (!this._capturingHistory) return;
        this._capturingHistory = false;

        const before = this._captureSnapshot;
        this._captureSnapshot = null;
        if (!before) return;

        const deltas: TileDelta[] = [];

        for (let layer = 0; layer < this.layerCount; layer++) {
            const beforeLayer = before[layer];
            const afterLayer = this.tileGrid[layer];
            if (!beforeLayer || !afterLayer) continue;

            for (let y = 0; y < this.mapHeight; y++) {
                for (let x = 0; x < this.mapWidth; x++) {
                    const fromVal = beforeLayer[y]?.[x] ?? 0;
                    const toVal   = afterLayer[y]?.[x]   ?? 0;
                    if (fromVal !== toVal) {
                        deltas.push({ layer, x, y, from: fromVal, to: toVal });
                    }
                }
            }
        }

        // Не сохраняем пустые записи
        if (deltas.length === 0) return;

        this._pushHistoryEntry({ deltas, timestamp: Date.now() });
    },

    // ── Internal ──────────────────────────────────────────────────────────

    /**
     * Добавить запись в стек истории, очистить redo-стек и применить лимит.
     */
    _pushHistoryEntry(this: any, entry: HistoryEntry) {
        this.undoStack.push(entry);
        this.redoStack = []; // Новое действие сбрасывает redo

        if (this.undoStack.length > this.maxStackSize) {
            this.undoStack.shift();
        }
        // BUG-08 fix: redoStack also needs a size cap to prevent memory leaks
        if (this.redoStack.length > this.maxStackSize) {
            this.redoStack.shift();
        }
    },

    /**
     * Legacy: строит полный список дельт из текущего tileGrid vs нуля.
     * Используется в saveState() для обратной совместимости.
     * По сути это "сохранить весь текущий tileGrid как дельту от предыдущего состояния".
     */
    _buildFullSnapshotDeltas(this: any): TileDelta[] {
        // Берём предыдущее состояние из вершины стека (если есть)
        const prev = this.undoStack.length > 0
            ? this.undoStack[this.undoStack.length - 1]
            : null;

        // Строим быстрый lookup: "layer,x,y" → fromValue
        const prevMap = new Map<string, number>();
        if (prev) {
            for (const d of prev.deltas) {
                // Это дельта предыдущей операции — восстанавливаем `to` как "текущее перед нашим действием"
                prevMap.set(`${d.layer},${d.x},${d.y}`, d.to);
            }
        }

        // Полный снапшот текущего состояния
        const snapshot = this.cloneLayeredMap();
        const deltas: TileDelta[] = [];

        for (let layer = 0; layer < this.layerCount; layer++) {
            if (!snapshot[layer]) continue;
            for (let y = 0; y < this.mapHeight; y++) {
                for (let x = 0; x < this.mapWidth; x++) {
                    const val = snapshot[layer][y]?.[x] ?? 0;
                    deltas.push({ layer, x, y, from: 0, to: val });
                }
            }
        }

        return deltas;
    },

    /**
     * Применить дельты к tileGrid (для undo: использует delta.from, для redo: delta.to).
     */
    _applyDeltas(this: any, deltas: TileDelta[], direction: 'undo' | 'redo') {
        for (const d of deltas) {
            const layer = this.tileGrid[d.layer];
            if (!layer || !layer[d.y]) continue;
            layer[d.y][d.x] = direction === 'undo' ? d.from : d.to;
        }
    },

    // ── Public: Undo / Redo ───────────────────────────────────────────────

    undo(this: any) {
        if (this.undoStack.length === 0) return;

        // Сохраняем текущее состояние в redo (полный снапшот для надёжности)
        const currentEntry: HistoryEntry = {
            deltas: this._buildFullSnapshotDeltas(),
            timestamp: Date.now(),
        };
        this.redoStack.push(currentEntry);

        // Достаём предыдущую запись и применяем дельты в обратную сторону
        const prev = this.undoStack.pop()!;
        this._applyDeltas(prev.deltas, 'undo');

        this._errorsDirty = true;
        this.draw();
    },

    redo(this: any) {
        if (this.redoStack.length === 0) return;

        // Сохраняем текущее состояние в undo
        const currentEntry: HistoryEntry = {
            deltas: this._buildFullSnapshotDeltas(),
            timestamp: Date.now(),
        };
        this.undoStack.push(currentEntry);

        // Достаём следующую запись и применяем дельты вперёд
        const next = this.redoStack.pop()!;
        this._applyDeltas(next.deltas, 'redo');

        this._errorsDirty = true;
        this.draw();
    },
};
