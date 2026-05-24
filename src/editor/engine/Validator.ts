/**
 * ValidatorMixin — проверка корректности расстановки тайлов.
 *
 * Определяет «зажатые» тайлы (squeezed tiles) — позиции, в которые
 * бравлер физически не может войти из-за окружающих стен.
 * Подсвечивает их красным при включённом режиме отображения ошибок.
 */
export const ValidatorMixin = {
    checkForErrors() {
        if (!this.showErrors) return;

        this.errorTiles.clear();

        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                if (this._validateTileAt(x, y)) {
                    this.errorTiles.add(`${x},${y}`);
                }
            }
        }
    },

    recalculateErrors() {
        this.errorTiles.clear();
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                if (this._validateTileAt(x, y)) {
                    this.errorTiles.add(`${x},${y}`);
                }
            }
        }
        this._errorsDirty = false;
    },

    /**
     * Internal helper to validate a single tile position.
     * Returns true if the tile has a connectivity error.
     */
    _validateTileAt(x, y) {
        const tileId = this.tileGrid[this.defaultTileLayer][y][x];

        // Skip block tiles
        if (this.isBlock(tileId)) return false;

        // Check for cardinal squeezes
        const horizontalPair = this.isBlockAt(x - 1, y) && this.isBlockAt(x + 1, y);
        const verticalPair = this.isBlockAt(x, y - 1) && this.isBlockAt(x, y + 1);

        // Diagonal block corners squeezing against a flat wall or border
        const horizontalSqueezeLeft = this.isBlockAt(x - 1, y) && this.isBlockAt(x + 1, y - 1) && this.isBlockAt(x + 1, y + 1);
        const horizontalSqueezeRight = this.isBlockAt(x + 1, y) && this.isBlockAt(x - 1, y - 1) && this.isBlockAt(x - 1, y + 1);
        const verticalSqueezeTop = this.isBlockAt(x, y - 1) && this.isBlockAt(x - 1, y + 1) && this.isBlockAt(x + 1, y + 1);
        const verticalSqueezeBottom = this.isBlockAt(x, y + 1) && this.isBlockAt(x - 1, y - 1) && this.isBlockAt(x + 1, y - 1);

        const cornerSqueeze = horizontalSqueezeLeft || horizontalSqueezeRight || verticalSqueezeTop || verticalSqueezeBottom;

        // Standard diagonal-to-diagonal opposite blocks
        const diagonalPair = (this.isBlockAt(x - 1, y - 1) && this.isBlockAt(x + 1, y + 1) && !this.isBlockAt(x - 1, y) && !this.isBlockAt(x + 1, y) && !this.isBlockAt(x, y - 1) && !this.isBlockAt(x, y + 1)) ||
                             (this.isBlockAt(x + 1, y - 1) && this.isBlockAt(x - 1, y + 1) && !this.isBlockAt(x - 1, y) && !this.isBlockAt(x + 1, y) && !this.isBlockAt(x, y - 1) && !this.isBlockAt(x, y + 1));

        // 1-tile diagonal passages
        const diagSqueeze1 = this.isBlockAt(x - 1, y) && this.isBlockAt(x, y + 1) && this.isBlockAt(x + 1, y - 1) && !this.isBlockAt(x, y - 1) && !this.isBlockAt(x + 1, y);
        const diagSqueeze2 = this.isBlockAt(x + 1, y) && this.isBlockAt(x, y + 1) && this.isBlockAt(x - 1, y - 1) && !this.isBlockAt(x, y - 1) && !this.isBlockAt(x - 1, y);
        const diagSqueeze3 = this.isBlockAt(x - 1, y) && this.isBlockAt(x, y - 1) && this.isBlockAt(x + 1, y + 1) && !this.isBlockAt(x, y + 1) && !this.isBlockAt(x + 1, y);
        const diagSqueeze4 = this.isBlockAt(x + 1, y) && this.isBlockAt(x, y - 1) && this.isBlockAt(x - 1, y + 1) && !this.isBlockAt(x, y + 1) && !this.isBlockAt(x - 1, y);
        const diagSqueeze = diagSqueeze1 || diagSqueeze2 || diagSqueeze3 || diagSqueeze4;

        const isSqueezed = verticalPair || horizontalPair || cornerSqueeze || diagonalPair || diagSqueeze;

        // Fall back to transition/cluster detection for dense walled areas or fully enclosed cells
        const directions = [
            { dx: -1, dy: -1 },
            { dx: 0, dy: -1 },
            { dx: 1, dy: -1 },
            { dx: 1, dy: 0 },
            { dx: 1, dy: 1 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 1 },
            { dx: -1, dy: 0 },
        ];

        const neighborBlocks = directions.map(dir => this.isBlockAt(x + dir.dx, y + dir.dy));

        let startIndex = 0;
        for (let i = 0; i < 7; i++) {
            if (neighborBlocks[i] !== neighborBlocks[(i + 1) % 8]) {
                startIndex = (i + 1) % 8;
                break;
            }
        }

        let transitions = 0;
        let blockCount = 0;
        for (let i = 0; i < 8; i++) {
            const current = neighborBlocks[(startIndex + i) % 8];
            const next = neighborBlocks[(startIndex + i + 1) % 8];
            if (current !== next) transitions++;
            if (next) blockCount++;
        }

        const fullySurrounded = transitions === 0 && neighborBlocks[startIndex];
        const denseCluster = transitions === 2 && blockCount > 5;

        return (fullySurrounded || denseCluster || isSqueezed);
    },

    toggleShowErrors() {
        this.showErrors = !this.showErrors;

        // Update UI
        const showErrorsBtn = document.getElementById('errorsBtn') as HTMLInputElement | null;
        if (showErrorsBtn) {
            showErrorsBtn.checked = this.showErrors;
            showErrorsBtn.parentElement?.classList.toggle('active', this.showErrors);
            showErrorsBtn.parentElement?.classList.toggle('active-red', this.showErrors);
        }

        // Clear error tiles if deactivated
        if (!this.showErrors) {
            this.errorTiles.clear();
        } else {
            this._errorsDirty = true; // Force fresh check on activation
        }
        this.draw();
    }
};
