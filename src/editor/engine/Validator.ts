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

        // 1-tile diagonal passages and Knight's move gaps
        const emptyBottomRight = !this.isBlockAt(x, y + 1) && !this.isBlockAt(x + 1, y);
        const emptyTopRight = !this.isBlockAt(x, y - 1) && !this.isBlockAt(x + 1, y);
        const emptyBottomLeft = !this.isBlockAt(x, y + 1) && !this.isBlockAt(x - 1, y);
        const emptyTopLeft = !this.isBlockAt(x, y - 1) && !this.isBlockAt(x - 1, y);

        const knightSqueeze = 
            (emptyBottomRight && this.isBlockAt(x + 1, y + 1) && (this.isBlockAt(x - 1, y) || this.isBlockAt(x, y - 1))) ||
            (emptyTopRight && this.isBlockAt(x + 1, y - 1) && (this.isBlockAt(x - 1, y) || this.isBlockAt(x, y + 1))) ||
            (emptyBottomLeft && this.isBlockAt(x - 1, y + 1) && (this.isBlockAt(x + 1, y) || this.isBlockAt(x, y - 1))) ||
            (emptyTopLeft && this.isBlockAt(x - 1, y - 1) && (this.isBlockAt(x + 1, y) || this.isBlockAt(x, y + 1)));

        // "Elbow squeeze": two cardinally-adjacent blocks that share only a corner (diagonal pair)
        // create an impassable gap. The empty cells at the opposite corners of that 2×2 area
        // (i.e., this cell) are flagged because a brawler cannot pass through a shared block corner.
        //
        //   Example:  . B       Cell (0,0) sees block RIGHT (1,0) and block DOWN (0,1),
        //             B .       but NOT block at BOTTOM-RIGHT (1,1).
        //                       → This "elbow" is impassable in Brawl Stars.
        //
        // We check all four L-shaped combinations. We only fire when the diagonal
        // between the two adjacent blocks is EMPTY (solid L-corners are caught by other rules).
        // NOTE: We use isRealBlock (not isBlockAt) so that map boundary pseudo-walls don't
        // generate false positives for cells near the map edges.
        const isRealBlock = (bx, by) => {
            if (bx < 0 || bx >= this.mapWidth || by < 0 || by >= this.mapHeight) return false;
            return this.isBlock(this.tileGrid[this.defaultTileLayer][by][bx]);
        };
        const elbowSqueeze =
            (isRealBlock(x + 1, y) && isRealBlock(x, y + 1) && !this.isBlockAt(x + 1, y + 1)) ||
            (isRealBlock(x + 1, y) && isRealBlock(x, y - 1) && !this.isBlockAt(x + 1, y - 1)) ||
            (isRealBlock(x - 1, y) && isRealBlock(x, y + 1) && !this.isBlockAt(x - 1, y + 1)) ||
            (isRealBlock(x - 1, y) && isRealBlock(x, y - 1) && !this.isBlockAt(x - 1, y - 1));

        const isSqueezed = verticalPair || horizontalPair || cornerSqueeze || diagonalPair || knightSqueeze || elbowSqueeze;

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
