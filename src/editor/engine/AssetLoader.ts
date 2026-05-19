/**
 * AssetLoaderMixin — загрузка и кэширование игровых ассетов.
 *
 * Отвечает за: фоновые изображения окружения, тайловые спрайты,
 * анимированные водные тайлы, ледяные/снежные тайлы, и изображения целей (goal images).
 * Все изображения загружаются с автоматическим fallback на окружение Desert.
 */

/** Extended image element that carries the biome context it was loaded for. */
interface EnvHTMLImageElement extends HTMLImageElement {
    parentEnvironment?: string;
}

/** Minimal shape of a tile definition entry from tileDefinitions. */
interface TileDef {
    img?: string;
    getImg?: (gamemode: string, frame: number, mapHeight: number, env: string) => { img: string } | null | undefined;
    showInEnvironment?: string[];
    [key: string]: unknown;
}

export const AssetLoaderMixin = {
preloadWaterTiles() {
        if (!this.tileImages) this.tileImages = {};
        if (!this.tileImagePaths) this.tileImagePaths = {};

        this.waterTileFilenames.forEach(filename => {
            const imagePath = `Resources/${this.environment}/Water/${filename}`;
            const cacheKey = `${this.environment}_water_${filename}`;

            // Skip if already loaded with the same path
            if (this.tileImagePaths[cacheKey] === imagePath && this.tileImages[cacheKey]?.complete) {
                return;
            }

            const img = new Image() as EnvHTMLImageElement;
            img.parentEnvironment = this.environment; // Affix environment context for the global interceptor
            img.src = imagePath;

            img.onerror = () => {
                console.error(`Failed to load water image: ${imagePath}`);
                const fallbackPath = `Resources/${this.environment}/Water/00000000.png`;
                img.src = fallbackPath;
                this.tileImagePaths[cacheKey] = fallbackPath;
            };

            this.tileImages[cacheKey] = img;
            this.tileImagePaths[cacheKey] = imagePath;
        });

        // === Ice and Snow support ===
        this.preloadIceAndSnowTiles();
    },

preloadIceAndSnowTiles() {
        if (!this.tileImages) this.tileImages = {};
        if (!this.tileImagePaths) this.tileImagePaths = {};

        const tileTypes = [
            { key: "ice",  path: "Resources/Global/Special_Tiles/IceTile"  },
            { key: "snow", path: "Resources/Global/Special_Tiles/SnowTile" },
        ];

        tileTypes.forEach(type => {
            this.waterTileFilenames.forEach(filename => {
                const imagePath = `${type.path}/${filename}`;
                const cacheKey  = `${type.key}_${filename}`;

                if (this.tileImagePaths[cacheKey] === imagePath && this.tileImages[cacheKey]?.complete) {
                    return;
                }

                const img = new Image();
                img.src = imagePath;

                img.onerror = () => {
                    console.error(`вќЊ Failed to load ${type.key} tile: ${imagePath}`);
                    const fallbackPath = `${type.path}/00000000.png`;
                    img.src = fallbackPath;
                    this.tileImagePaths[cacheKey] = fallbackPath;
                };

                this.tileImages[cacheKey]  = img;
                this.tileImagePaths[cacheKey] = imagePath;
            });
        });
    },

async preloadGoalImage(name, environment) {
        if (!this.goalImageCache) this.goalImageCache = {};
        if (!this.tileImagePaths) this.tileImagePaths = {};

        const key = `${name}${environment}`;
        const fallbackKey = `${name}`;
        const primaryPath = `Resources/Global/Goals/${name}${environment}.png`;
        const fallbackPath = `Resources/Global/Goals/${name}.png`;

        // If already loaded with the correct path, return
        if (this.goalImageCache[key] && this.tileImagePaths[key] === primaryPath) {
            return this.goalImageCache[key];
        }
        if (this.goalImageCache[fallbackKey] && this.tileImagePaths[fallbackKey] === fallbackPath) {
            return this.goalImageCache[fallbackKey];
        }

        const img = new Image() as EnvHTMLImageElement;
        img.parentEnvironment = environment; // Affix environment context for the global interceptor

        return new Promise((resolve) => {
            img.onload = () => {
                this.goalImageCache[key] = img;
                this.tileImagePaths[key] = primaryPath;
                resolve(img);
            };
            img.onerror = () => {
                const fallbackImg = new Image() as EnvHTMLImageElement;
                fallbackImg.parentEnvironment = environment; // Carry environment context to the fallback image
                fallbackImg.onload = () => {
                    this.goalImageCache[fallbackKey] = fallbackImg;
                    this.tileImagePaths[fallbackKey] = fallbackPath;
                    resolve(fallbackImg);
                };
                fallbackImg.onerror = () => resolve(null);
                fallbackImg.src = fallbackPath;
            };
            img.src = primaryPath;
        });
    },

async loadEnvironmentBackgrounds() {
        return new Promise<void>((resolve) => {
            let loadedCount = 0;
            const onLoad = () => {
                loadedCount++;
                if (loadedCount === 2) {
                    this.draw();
                    resolve();
                }
            };

            // Affix environment contexts to background image instances to secure biome integrity
            (this.bgDark as EnvHTMLImageElement).parentEnvironment = this.environment;
            (this.bgLight as EnvHTMLImageElement).parentEnvironment = this.environment;

            this.bgDark.onload = onLoad;
            this.bgLight.onload = onLoad;

            this.bgDark.src = `Resources/${this.environment}/BGDark.png`;
            this.bgLight.src = `Resources/${this.environment}/BGLight.png`;

            // Guard against infinite onerror loops: null the handler before retrying with fallback.
            // If even the Desert fallback fails, call onLoad() anyway so the promise always resolves.
            this.bgDark.onerror = () => {
                this.bgDark.onerror = null;
                const src = this.bgDark.src || '';
                if (this.environment !== 'Desert' && !src.includes('Desert')) {
                    this.bgDark.onerror = () => { this.bgDark.onerror = null; onLoad(); };
                    this.bgDark.src = 'Resources/Desert/BGDark.png';
                } else {
                    onLoad(); // Total failure — still resolve so initialize() doesn't hang
                }
            };
            this.bgLight.onerror = () => {
                this.bgLight.onerror = null;
                const src = this.bgLight.src || '';
                if (this.environment !== 'Desert' && !src.includes('Desert')) {
                    this.bgLight.onerror = () => { this.bgLight.onerror = null; onLoad(); };
                    this.bgLight.src = 'Resources/Desert/BGLight.png';
                } else {
                    onLoad(); // Total failure — still resolve so initialize() doesn't hang
                }
            };
        });
    },

async loadTileImages() {
        if (!this.tileImages) this.tileImages = {};
        if (!this.tileImagePaths) this.tileImagePaths = {};
        
        return new Promise<void>((resolve) => {
            let loadedCount = 0;
            const tileDefs = Object.entries(this.tileDefinitions) as [string, TileDef][];
            const relevantTiles = tileDefs.filter(([id, def]) => 
                (def.img || def.getImg) &&
                (!def.showInEnvironment || def.showInEnvironment.includes(this.environment) || id === '45')
            );
    
            const totalImages = relevantTiles.length;
    
            const onLoad = () => {
                loadedCount++;
                if (loadedCount === totalImages) {
                    this.draw();
                    resolve();
                }
            };
    
            relevantTiles.forEach(([id, def]) => {
                let imgPath = null;
                let envToUse = this.environment;
                if (id === '45') {
                    if (def.showInEnvironment && !def.showInEnvironment.includes(envToUse)) {
                        envToUse = 'Tropical_Island';
                    }
                }
    
                if (def.getImg) {
                    const imgData = def.getImg(this.gamemode, 0, this.mapHeight, envToUse);
                    if (!imgData) {
                        onLoad();
                        return;
                    }
                    imgPath = `Resources/${imgData.img.replace('${env}', envToUse)}`;
                } else if (def.img) {
                    imgPath = `Resources/${def.img.replace('${env}', envToUse)}`;
                }
    
                // Check if the same image was already loaded
                if (this.tileImagePaths[id] === imgPath && this.tileImages[id]?.complete) {
                    onLoad();
                    return;
                }
    
                const img = new Image() as EnvHTMLImageElement;
                img.parentEnvironment = envToUse; // Affix environment context to the tile image instance
                img.onload = onLoad;
                img.onerror = () => {
                    // Try fallback to 'Desert' environment if current fails and uses '${env}'
                    const currentPath = this.tileImagePaths[id] || imgPath;
                    if (this.environment !== 'Desert' && imgPath.includes(this.environment) && !currentPath.includes('Desert')) {
                        const fallbackPath = imgPath.replace(this.environment, 'Desert');
                        this.tileImagePaths[id] = fallbackPath;
                        img.src = fallbackPath;
                    } else {
                        onLoad();
                    }
                };
    
                img.src = imgPath;
                this.tileImages[id] = img;
                this.tileImagePaths[id] = imgPath;
            });
        });
    },

loadGoalImage(name, environment) {
        return new Promise((resolve) => {
            const img = new Image();
            const fallback = `Resources/Global/Goals/${name}.png`;
            const envPath = `Resources/Global/Goals/${name}${environment}.png`;

            img.onload = () => resolve(img);
            img.onerror = () => {
                // Retry with default fallback if environment-specific one fails
                img.onerror = null;
                img.src = fallback;
            };
            img.src = envPath;
        });
    }
};
