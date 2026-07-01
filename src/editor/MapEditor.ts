// @ts-nocheck
import { supabase } from '../core/supabase-client.js';
import {
    TILE_RENDER_DATA,
    OBJECTIVE_DATA,
    ENV_OBJECTIVE_DATA,
    ENV_TILE_RENDER_DATA,
    WATER_FILENAMES,
    getTileDefinitions
} from './editor-config.js';
import { FenceAutoTiler } from '../utils/fence-auto-tiler.js';
import { EventBus } from './engine/EventBus.js';
import { createDefaultEditorState } from './engine/EditorState.js';

// Import Engine Subsystems (Mixins)
import { ViewportMixin } from './engine/Viewport.js';
import { HistoryMixin } from './engine/History.js';
import { AssetLoaderMixin } from './engine/AssetLoader.js';
import { MapDataMixin } from './engine/MapData.js';
import { InputMixin } from './engine/Input.js';
import { RendererMixin } from './engine/Renderer.js';
import { ValidatorMixin } from './engine/Validator.js';
import { IOMixin } from './engine/IO.js';

export class MapEditor {
    constructor(canvasId, headless = false, existingMap = false) {
        if (typeof canvasId === 'string') {
            this.canvas = document.getElementById(canvasId);
        } else {
            this.canvas = canvasId;
        }

        if (!this.canvas) {
            throw new Error('Canvas not found');
        }

        this.headless = headless;
        this.existingMap = existingMap;
        this.ctx = this.canvas.getContext('2d');
        this.tileSize = 32;
        this.canvasPadding = 64;  // Increased padding so large goals with negative offsets don't get cut off

        this.layerCount = 5;
        this.defaultTileLayer = 2;

        this.tileImages = {};
        
        // Map size configurations
        this.mapSizes = {
            regular: { width: 21, height: 33 },
            showdown: { width: 60, height: 60 },
            arena: { width: 59, height: 59 },
            siege: { width: 27, height: 39 },
            volley: { width: 21, height: 25 },
            basket: { width: 21, height: 17 }
        };
        
        // Initialize with default size (regular)
        this.mapWidth = this.mapSizes.regular.width;
        this.mapHeight = this.mapSizes.regular.height;
        this.mapSize = this.mapSizes.regular;
        
        // Initialize undo/redo stacks
        this.undoStack = [];
        this.redoStack = [];
        this.maxStackSize = 50; // Hard cap — prevents unbounded memory growth during long editing sessions
        
        this.zoomLevel = 0.775;
        this.minZoom = 0.2;
        this.maxZoom = 3;
        this.zoomStep = 0.05;
        this.delta = 1.75;

        this._drawPending = false;
        this._errorsDirty = true;

        // ── Event Bus — pub/sub for decoupled subsystem communication ────────
        // Usage: this.events.on('tile:placed', handler) / this.events.emit('tile:placed', data)
        this.events = new EventBus();

        // ── Typed Editor State ────────────────────────────────────────────────
        // All boolean flags and UI state in one typed object.
        // Backward-compat: we also assign them directly on `this` below
        // so existing mixin code (this.isErasing, etc.) keeps working unchanged.
        this.state = createDefaultEditorState();

        // Initialize map data
        this.tileGrid = this.createEmptyLayeredMap(this.mapWidth, this.mapHeight);

        // History delta capture state (used by new delta-based History)
        this._capturingHistory = false;
        this._captureSnapshot  = null;

        
        this.activeToolBrush = { id: 1, name: 'Wall', color: '#666666' };
        this.activeToolBrushs = [];
        this.isErasing = false;
        this.viewPanActive = false;
        this.isDragging = false;
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.draggedTileId = null;
        this.dragStartX = null;
        this.dragStartY = null;

        // Mirroring state
        this.mirrorVertical = false;
        this.mirrorHorizontal = false;
        this.mirrorDiagonal = false;
        this.smartSymmetry = true; // Always on, permanently

        // Game settings
        this.gamemode = 'Gem_Grab';
        this.environment = 'Desert';
        this.goalImages = [];
        this.goalImageCache = {}; // key: goalName+env, value: loaded Image


        // Selection mode
        this.selectionMode = 'single';
        this.selectionStart = null;
        this.selectionEnd = null;
        this.hoveredTiles = new Set();
        this.errorTiles = new Set();
        this.mouseDown = false;

        this.showErrors = false;
        this.showGuides = false; 
        
        this.loadedMapId = null; // Tracks the active map identifier if loaded in direct Edit mode!
        this.collabLinkId = null; // Tracks collab share link ID if editing a friend's map
        this.collabOriginalMapId = null; // Tracks original map ID during collaboration

        // Environment and background
        this.bgDark = new Image();
        this.bgLight = new Image();

        // Initialize tile data
        this.tileData = { ...TILE_RENDER_DATA };

        // Initialize objective data
        this.objectiveData = { ...OBJECTIVE_DATA };

        // Initialize environment data
        this.environmentObjectiveData = { ...ENV_OBJECTIVE_DATA };

        this.environmentTileData = { ...ENV_TILE_RENDER_DATA };

        // Initialize tile definitions
        this.tileDefinitions = getTileDefinitions(this);

        Object.values(this.tileDefinitions).forEach(def => {
            if (!def) return;
            if (typeof def.layer !== 'number') {
                def.layer = this.defaultTileLayer;
            }
        });

        // Initialize water tile filenames
        this.waterTileFilenames = WATER_FILENAMES;
          
        // Initialize fence logic handler
        this.fenceLogicHandler = new FenceAutoTiler();

        // Initialize UI and event listeners
        // NOTE: initializeUI() already calls initializeTileSelector() internally.
        // Do NOT call initializeTileSelector() here again — that causes duplicate event listeners on every tile button.
        if (!this.headless) {
            this.initializeUI();
            this.initializeEventListeners();
        }

        // Canvas pixel dimensions must reflect the map size BEFORE we compute
        // the fit-to-container zoom below — otherwise autoScaleViewport() would
        // measure against stale/default canvas dimensions.
        this.updateCanvasSize();

        if (!this.headless) {
            // Set initial zoom to fit the map inside its container
            this.autoScaleViewport();
            this.applyDeviceZoomSettings();

            // Center the map in the editor after layout settles
            requestAnimationFrame(() => {
                this.updateCanvasZoom();
                this.centerCanvas();
            });
        }

        // Initialize the map maker only if not loading an existing map to prevent racing!
        if (!this.existingMap) {
            this.initialize();
        }
        
        // Preload water tiles
        this.preloadWaterTiles();

        this.baseObjectiveData           = { ...this.objectiveData };
        this.baseEnvironmentObjectiveData = { ...this.environmentObjectiveData };

        this.isSelectDragging = false;
        this.selectDragStart = null;
        this.selectDragOffset = {x: 0, y: 0};
        this.selectDragTiles = [];
        this.selectDragLastPos = null;
    }


    async initialize() {
        try {
            // HYDRATION FIX: Guarantee active custom skins are fully resolved from database before asset preloading!
            const activeSkin = localStorage.getItem('editor_active_skin');
            if (activeSkin && activeSkin.startsWith('CUSTOM_')) {
                const packId = activeSkin.replace('CUSTOM_', '');
                if (typeof window.ensureThemeLoaded === 'function') {
                    await window.ensureThemeLoaded(packId);
                }
            }

            await this.loadEnvironmentBackgrounds();
            await this.loadTileImages();
            if (this.headless || this.existingMap) return;
            await this.setGamemode(this.gamemode);
        } catch (error) {
            console.error('Error initializing MapEditor:', error);
        }
    }

    
    initializeUI() {
        // Initialize gamemode selector
        if (this.headless) return;
        const gamemodeSelect = document.getElementById('gamemode');
        gamemodeSelect.value = this.gamemode;
        
        // Initialize environment selector and populate equipped theme optgroup
        const environmentSelect = document.getElementById('environment');
        
        try {
            let equippedArr = [];
            const storedPlural = localStorage.getItem('equipped_themes');
            const storedSingular = localStorage.getItem('equipped_theme');
            
            // 1. Try plural array (current spec)
            if (storedPlural) {
                equippedArr = JSON.parse(storedPlural);
                if (!Array.isArray(equippedArr)) equippedArr = [];
            }
            
            // 2. Fallback to singular single-theme (legacy spec)
            if (equippedArr.length === 0 && storedSingular) {
                try {
                    const pack = JSON.parse(storedSingular);
                    if (pack && pack.id) {
                        equippedArr = [pack];
                    }
                } catch(e) {}
            }
            
            console.info("[ThemeLoader] Located " + equippedArr.length + " active theme(s) for selector injection.");
            
            if (equippedArr.length > 0) {
                let themeOptionsHtml = '';
                equippedArr.forEach(p => {
                    const safeName = (p.name || 'Custom Theme').replace(/"/g, '&quot;');
                    const safeAuthor = (p.user_name || 'Builder').replace(/"/g, '&quot;');
                    themeOptionsHtml += `<option value="CUSTOM_${p.id}" style="color:#ff8bfa;">✨ ${safeName} | By: ${safeAuthor}</option>`;
                });
                
                // Direct seamless append to the bottom of options
                environmentSelect.innerHTML = environmentSelect.innerHTML + themeOptionsHtml;
                
                console.info("[ThemeLoader] Successfully injected clean custom themes into environment selector.");
            }
        } catch(e) {
            console.warn("[ThemeLoader] Failed dynamically embedding themes into selector:", e);
        }

        // Apply stored session skin overrides if existing
        const activeSkin = localStorage.getItem('editor_active_skin');
        if (activeSkin && environmentSelect.querySelector(`option[value="${activeSkin}"]`)) {
            environmentSelect.value = activeSkin;
            this.environment = 'Desert'; // Under the hood, drive loader through Desert
        } else {
            environmentSelect.value = this.environment;
        }

        // Initialize tile selector with current gamemode
        this.initializeTileSelector();
        
        // Update canvas size to include padding
        this.updateCanvasSize();
    }
}

// Assemble Engine dynamically via Prototypal Mixin Composition
Object.assign(
    MapEditor.prototype,
    ViewportMixin,
    HistoryMixin,
    AssetLoaderMixin,
    MapDataMixin,
    InputMixin,
    RendererMixin,
    ValidatorMixin,
    IOMixin
);

// Global Instantiation hook for pages carrying the editor canvas
const targetCanvas = document.getElementById('mapCanvas');
if (targetCanvas) {
    const urlParams = new URLSearchParams(window.location.search);
    const mapId = urlParams.get('id');
    const collabId = urlParams.get('collab');

    window.mapEditor = new MapEditor('mapCanvas', false, !!(mapId || collabId));
    console.info('[Compass] Clean Modularized MapEditor initialized successfully.');
    
    if (collabId) {
        console.info(`[Compass] Initiating collaborative auto-load routine for Collab Link ID: ${collabId}`);
        window.mapEditor.loadCollabMap(collabId);
    } else if (mapId) {
        console.info(`[Compass] Initiating auto-load routine for shared Map ID: ${mapId}`);
        window.mapEditor.loadMap(mapId);
    }
} else {
    console.debug('[Compass] Skipped MapEditor constructor (running headless for renderer).');
}
