// @ts-nocheck
/**
 * Compass — Global Visual Themes & Localization Engine
 * Injects controls, manages state, monkey-patches Canvas contexts, and handles i18n.
 */

const APP_THEMES = {
    'space': 'Deep Space',
    'sand': 'Dry Sand',
    'sea': 'Sea Wave',
    'poison': 'Poisonous Black',
    'gray': 'Grayish Gray',
    'crystal': 'Crystal White',
    'sunset': 'Desert Sunset',
    'breeze': 'Ocean Breeze'
};

const TRANSLATIONS = {
    'ru': {
        'Map Maker': 'Создать карту',
        'Gallery': 'Галерея',
        'My Maps': 'Мои карты',
        'Custom Tiles': 'Свои тайлы',
        'Contests': 'Контесты',
        'soon': 'скоро',
        'Start Creating': 'Начать создание',
        'Sign in with Discord': 'Войти через Discord',
        'Browse Maps': 'Поиск карт',
        'Settings': 'Настройки',
        'Language': 'Язык',
        'Theme': 'Тема',
        'Deep Space': 'Глубокий космос',
        'Dry Sand': 'Сухой песок',
        'Sea Wave': 'Морская волна',
        'Crystal White': 'Кристально белый',
        'Poisonous Black': 'Ядовито черный',
        'Grayish Gray': 'Серовато серый',
        'Desert Sunset': 'Пустынный закат',
        'Ocean Breeze': 'Морской бриз',
        'Profile': 'Профиль',
        'Log Out': 'Выйти',
        'Map Settings': 'Настройки карты',
        'Map Name': 'Имя карты',
        'Untitled Map': 'Карта без названия',
        'Map Size': 'Размер карты',
        'Gamemode': 'Режим игры',
        'Environment': 'Окружение',
        'Opacity': 'Прозрачность',
        'Tiles': 'Тайлы',
        'Selection Options': 'Опции выделения',
        'Single': 'Один',
        'Line': 'Линия',
        'Rectangle': 'Прямоугольник',
        'Fill': 'Заливка',
        'Select': 'Выделение',
        'Tools': 'Инструменты',
        'Mirroring': 'Зеркало',
        'Diagonal': 'Диагональ',
        'Vertical': 'Вертикаль',
        'Horizontal': 'Горизонталь',
        'Reset Layout': 'Сбросить макет',
        '↺ Reset Layout': '↺ Сбросить макет',
        '⟲ Reset Layout': '⟲ Сбросить макет',
        'Keyboard Shortcuts': 'Горячие клавиши',
        'Save Map': 'Сохранить',
        'Download Map': 'Скачать PNG',
        'Clear Map': 'Очистить',
        'Link:': 'Ссылка:',
        'Search maps by name...': 'Искать карты по названию...',
        'All Gamemodes': 'Все режимы',
        'All Environments': 'Все окружения',
        'All Sizes': 'Все размеры',
        'Sort By...': 'Сортировать...',
        'Best Rating': 'По рейтингу',
        'Most Votes': 'По голосам',

        'By:': 'От:',
        'This site is not affiliated with or endorsed by Supercell. Brawl Stars and all related assets belong to Supercell.': 'Этот сайт не связан с Supercell и не поддерживается ею. Brawl Stars и все связанные активы принадлежат Supercell.',
        'NOT AFFILIATED WITH SUPERCELL': 'НЕ СВЯЗАНО С SUPERCELL',
        'Area Select Tools:': 'Инструменты выделения:',
        '🌍 Public': '🌍 Публичная',
        'The best map-making tool.': '<span class="accent">Лучший</span> инструмент<br>создания карт.',
        'Precision tile editor with 50+ environments, smart mirroring, real-time error detection, and every game mode supported. Build maps that dominate the competition.': 'Точный редактор плиток, 50+ окружений, зеркалирование, детекция ошибок и поддержка всех игровых режимов.',
        'Create, rate, win!': 'Создавай, оценивай,<br><span class="accent">побеждай!</span>',
        'Design your dream map, share it with the community, and climb to the top. Integrated gallery, one-click export, and powerful editing tools - all in your browser.': 'Спроектируйте карту мечты, делитесь ей с сообществом и поднимайтесь вверх. Встроенная галерея и экспорт в один клик.',
        'Build better Maps.': 'Стройте карты<br><span class="accent">лучше.</span>',
        'Advanced map maker for Brawl Stars with full undo/redo, tile validation, auto-mirroring, and high-res PNG export. Your next map starts here.': 'Продвинутый редактор Brawl Stars с отменой действий, валидацией и экспортом PNG в высоком разрешении.',
        'Victory is just around the corner.': 'Победа уже<br><span class="accent">не за горами.</span>',
        'Every great victory starts with a great map. Use our professional tools to craft, test, and share maps that make a difference. Coming soon: online map voting & leaderboards.': 'Каждая великая победа начинается с отличной карты. Создавайте, тестируйте и делитесь своими шедеврами.',

        'Latest Updates': 'Последние обновления',
        'Redesigned theme settings for minimalistic aesthetics with clear light/dark grouping.': 'Обновлен дизайн настроек темы: минимализм с четким разделением на темные и светлые.',
        'Fixed theme flickering issues on page transitions.': 'Исправлено мерцание темы при переходе между страницами.',
        'Fixed editor initialization to fit viewport instead of scaling too large.': 'Масштаб редактора теперь автоматически подгоняется под размер экрана при открытии.',
        'Modified eraser tool highlight color to turn red instantly upon activation.': 'Цвет выделения ластика теперь становится красным сразу после выбора.',
        'Dark Themes': 'Темный фон',
        'Light Themes': 'Светлый фон',

        // NAVIGATION & NEW SECTIONS
        'Forum': 'Форум',
        'Contests': 'Конкурсы',

        // FORUM PAGE
        'Community Wall': 'Стена сообщества',
        'Say hello, share feedback, or just chat with other editors.': 'Скажите привет, поделитесь отзывом или пообщайтесь с картоделами.',
        'Write something to the community... (HTML/Scripts are stripped)': 'Напишите что-нибудь сообществу...',
        'Post Anonymously': 'Анонимно',
        'Send Message': 'Отправить',
        'Newest': 'Новые',
        'Top Liked': 'Популярные',
        'Loading community wall...': 'Загрузка стены...',
        'The community wall is silent. Be the first to break the silence!': 'На стене тихо. Напишите сообщение первым!',
        'Failed to load messages. Please try again later.': 'Не удалось загрузить сообщения.',
        'Anonymous': 'Аноним',
        'Delete Message': 'Удалить',
        'Are you absolutely sure you want to delete this message?': 'Вы уверены, что хотите удалить это сообщение?',
        'Failed to delete:': 'Не удалось удалить:',
        'Cannot send an empty message.': 'Нельзя отправить пустое сообщение.',
        'Message too long! Max 2500 characters allowed.': 'Слишком длинное! Макс. 2500 символов.',
        '⏳ Sending...': '⏳ Отправка...',
        'Failed to send message:': 'Ошибка отправки:',
        '⚠️ Please sign in via Discord to vote on messages!': '⚠️ Пожалуйста, войдите через Discord, чтобы голосовать!',
        'Failed to cast vote:': 'Ошибка голосования:',
        'Cooldown:': 'Подождите:',
        'Unresolved': 'Не решено',
        'Resolved': 'Решено',
        'Admin Reply': 'Ответ администратора',
        'Response from Hammer147': 'Ответ от Hammer147',
        'Attach Photo (max 5)': 'Прикрепить фото (макс. 5)',
        'Attach Video (max 2)': 'Прикрепить видео (макс. 2)',
        'Save Reply': 'Сохранить ответ',
        'Edit Reply': 'Изменить ответ',
        'Add Reply': 'Добавить ответ',
        'Write admin reply...': 'Написать ответ администратора...',
        'Max 5 photos allowed.': 'Разрешено максимум 5 фотографий.',
        'Max 2 videos allowed.': 'Разрешено максимум 2 видео.',
        'Please sign in via Discord to attach media!': 'Пожалуйста, войдите через Discord, чтобы прикреплять медиа!',
        'Failed to upload media.': 'Не удалось загрузить медиафайлы.',

        // BAN OVERLAY / SECURITY
        'Oops, Access Denied': 'Упс, доступ запрещен',
        'It seems you are on the blacklist.': 'Вы находитесь в черном списке.',
        'Reason from the Great Hammer147:': 'Причина от Великого Hammer147:',
        'Authenticated User': 'Авторизованный юзер',

        // CUSTOM TILES PAGE
        'Active Theme:': 'Активная тема:',
        'Loading...': 'Загрузка...',
        'Builder': 'Строитель',
        'Unequip': 'Снять',
        'Custom Tiles Studio': 'Студия своих тайлов',
        'Reimagine the game visually. Override standard tiles with your own designs.': 'Переосмыслите игру визуально. Заменяйте стандартные тайлы своими.',
        'New Pack': 'Новый пак',
        'Search custom tile packs...': 'Поиск паков тайлов...',
        'Most Liked': 'Популярные',
        'Newest First': 'Сначала новые',
        'My Creations': 'Мои творения',
        'Please sign in via Discord to view your private packs.': 'Пожалуйста, войдите через Discord, чтобы увидеть ваши паки.',
        'Tile Marketplace': 'Рынок тайлов',
        'Loading custom packs...': 'Загрузка паков...',
        'Uploading textures...': 'Загрузка текстур...',
        'Tile Pack Studio': 'Студия паков тайлов',
        'Pack Name': 'Имя пака',
        'Select standard tiles to customize': 'Выберите стандартные тайлы для кастомизации',
        'Click any item to replace it with an image from your device (.png/.jpg, max 1MB).': 'Нажмите на элемент, чтобы заменить его изображением (.png/.jpg, макс 1МБ).',
        '🌍 Public / Publish': '🌍 Публичный / Опубликовать',
        'Cancel': 'Отмена',
        'Save Pack': 'Сохранить пак',
        'Pixel Perfect Crop': 'Идеальная обрезка',
        '🔒 Ratio 1:1': '🔒 Соотношение 1:1',
        '🔄 Rotate': '🔄 Повернуть',
        'Apply Crop': 'Применить обрезку',
        'Equip Custom Theme?': 'Экипировать тему?',
        'Yes, Equip!': 'Да, экипировать!',
        'Apply': 'Применить',
        'created by': 'созданная',
        'as your active skin set in MapEditor and game?': 'как ваш активный набор скинов?',
        'Please sign in to like tile packs!': 'Пожалуйста, войдите, чтобы ставить лайки!',
        'Please sign in via Discord to create custom tile packs!': 'Войдите через Discord, чтобы создавать паки!',
        'Original file size too large! Max limit 5MB for cropping.': 'Размер файла слишком большой! Лимит 5МБ для обрезки.',
        'Could not read cropped region.': 'Не удалось прочитать обрезанную область.',
        'Please give your Tile Pack a name!': 'Пожалуйста, дайте вашему паку название!',
        'Customize at least one tile before saving!': 'Настройте хотя бы один тайл перед сохранением!',
        'Tile Pack safely deployed and published! ✨': 'Пак тайлов успешно опубликован! ✨',
        'Deployment failed. Verify your internet or Supabase SQL script implementation! Details:': 'Ошибка публикации. Проверьте интернет или настройки БД! Детали:',
        '✅ Tile pack': '✅ Пак тайлов',
        'has been successfully deleted!': 'был успешно удален!',
        '❌ Delete operation failed:': '❌ Ошибка удаления:',
        'Failed to update privacy settings.': 'Не удалось обновить настройки приватности.',

        // MY MAPS & MISC
        'Search maps by name...': 'Искать карты по названию...',
        'Accessing your vault...': 'Доступ к вашему хранилищу...',
        'Please sign in via Discord to view your private maps.': 'Войдите через Discord, чтобы увидеть ваши карты.',
        'Connection lost.': 'Соединение потеряно.',
        'You have not saved any maps yet.': 'У вас еще нет сохраненных карт.',
        'Start building in the Map Maker to fill your gallery.': 'Начните творить в редакторе, чтобы наполнить галерею.',
        'No matches found in your storage.': 'Ничего не найдено в вашем хранилище.',
        'Edit Details': 'Подробнее',
        '🗑️ Are you absolutely sure you want to delete this map forever?\n\nThis action CANNOT be undone.': '🗑️ Вы абсолютно уверены, что хотите удалить эту карту НАВСЕГДА?\n\nЭто действие невозможно отменить.',
        'Delete operation failed:': 'Не удалось удалить карту:',
        'Server could not save privacy update. Try again.': 'Не удалось обновить приватность на сервере. Попробуйте позже.',
        'Load More': 'Загрузить еще',
        '✅ Map deleted successfully!': '✅ Карта успешно удалена!',
        '❌ Failed to delete map:': '❌ Ошибка при удалении карты:',
        '⚠️ Please log in with Discord to like maps!': '⚠️ Пожалуйста, войдите через Discord, чтобы ставить лайки!',
        'Link:': 'Ссылка:',
        '⚠️ Please sign in via Discord to vote on comments!': '⚠️ Войдите через Discord, чтобы голосовать за комментарии!',
        'Comment too long! Max 2500 characters allowed.': 'Комментарий слишком длинный! Макс. 2500 символов.',
        'Failed to post comment:': 'Не удалось оставить комментарий:',
        '⚠️ Please Sign in with Discord to like maps!': '⚠️ Войдите через Discord, чтобы ставить лайки!',
        'Connecting to database...': 'Подключение к базе данных...',
        'Error connecting to secure database.': 'Ошибка подключения к защищенной базе данных.',
        'No public maps found.': 'Публичных карт не найдено.',
        'No matching maps found.': 'Совпадений не найдено.',
        'View Map': 'Посмотреть карту',
        'by': 'от',
        '🔒 Private': '🔒 Приватная',
        '🌍 Public': '🌍 Публичная',
        'Public': 'Публичная',
        'Private': 'Приватная',

        // MAPMAKER PAGE CUSTOM LABELS
        'Hand Tool (Pan)': 'Рука (Панорама)',
        'Flip Horizontal': 'Отразить по горизонтали',
        'Flip Vertical': 'Отразить по вертикали',
        'Single Selection': 'Одиночное выделение',
        'Line Selection': 'Линейное выделение',
        'Rectangle Selection': 'Прямоугольное выделение',
        'Fill Selection': 'Заливка',
        'Toggle Replace Mode': 'Режим замены',
        'Toggle Erase Mode': 'Режим ластика',
        'Toggle Mirroring': 'Зеркалирование',
        'Toggle Blue to Red Mirroring': 'Сине-Красное Зеркало',
        'Toggle Error Check': 'Проверка ошибок',
        'Undo': 'Отменить',
        'Redo': 'Повторить',
        'Clear Map': 'Очистить карту',
        '❌ Critical Failure: Could not retrieve map from secure database!': '❌ Критическая ошибка: Не удалось загрузить карту!',
        '❌ You must be logged in with Discord to save maps! Go to the Home page to log in.': '❌ Вы должны войти через Discord, чтобы сохранять карты!',
        'Map updated successfully in secure database!': 'Карта успешно обновлена в базе данных!',
        'Map saved successfully to Supabase database!': 'Карта успешно сохранена в базе данных!',
        'Failed to save map:': 'Не удалось сохранить карту:',
        
        // CUSTOM TILES PREVIEW MODAL
        'Theme Preview': 'Предосмотр темы',
        'Equip Theme': 'Экипировать тему',
        'Customized Tiles': 'Измененные тайлы',
        'Equipped': 'Экипировано',
        'Close': 'Закрыть',
        'No customized tiles in this pack.': 'В этом паке нет измененных тайлов.',
        'HITBOX': 'ХИТБОКС',
        'Ratio 1:1': 'Соотношение 1:1',
        'Free Form': 'Свободно',

        // SIZES
        'Regular': 'Обычный',
        'Showdown': 'Шоудаун',
        'Brawl Arena': 'Арена',
        'Siege': 'Осада',
        'Volley Brawl': 'Волейбой',
        'Basket Brawl': 'Баскетбой',

        // EDITOR TOGGLES
        'Show Theme in Gallery': 'Показывать тему в галерее',
        'Include Theme in PNG': 'Включать тему в PNG',
        'Show your custom theme to others in the gallery': 'Показывать вашу кастомную тему другим в галерее',
        'Include custom theme assets when downloading the map image': 'Включать кастомные ассеты при скачивании карты',
        'Public': 'Публичная',
        'Private': 'Приватная',

        // GALLERY FILTERS
        'Search maps by name...': 'Поиск карт по названию...',
        'All Gamemodes': 'Все режимы',
        'All Environments': 'Все окружения',
        'All Sizes': 'Все размеры',
        'Sort By...': 'Сортировать...',
        'Best Rating': 'Лучший рейтинг',
        'Most Votes': 'Больше голосов',

        // TILE CATEGORIES
        'Walls': 'Стены',
        'Water': 'Вода',
        'Bushes': 'Кусты',
        'Fences & Obstacles': 'Заборы и преграды',
        'Spawns': 'Спавны',
        'Objectives & Items': 'Цели и Объекты',
        'Special': 'Специальные',
        'Jump Pads': 'Джампады',
        'Teleporters': 'Телепорты',

        // EDITOR MISC
        'Hide Top Bar': 'Скрыть верхнюю панель',
        'Show Top Bar': 'Показать верхнюю панель'
    }
};

// 🌍 GLOBAL TRANSLATE HELPER (For Dynamic JavaScript Strings!)
window.cp_translate = function (key) {
    const currentLang = localStorage.getItem('cp_app_lang') || 'en';
    if (currentLang === 'en') return key;
    const dict = TRANSLATIONS[currentLang];
    return (dict && dict[key]) ? dict[key] : key;
};


// 🪝 CANVAS INTERCEPT SYSTEM (Monkeys Canvas2D dynamically to swap theme colors in background vortices!)
(function setupCanvasInterceptor() {
    const mappings = {
        'sand': {
            r: [230, 245, 189],
            g: [166, 196, 122],
            b: [98, 128, 47]
        },
        'sea': {
            r: [0, 0, 3],
            g: [240, 180, 4],
            b: [255, 216, 94]
        },
        'poison': {
            r: [57, 0, 18],
            g: [255, 255, 80],
            b: [20, 136, 22]
        },
        'gray': {
            r: [220, 160, 120],
            g: [220, 160, 120],
            b: [220, 160, 120]
        },
        'crystal': {
            r: [37, 56, 100],
            g: [99, 189, 120],
            b: [235, 248, 150]
        },
        'sunset': {
            r: [249, 254, 236],
            g: [115, 215, 72],
            b: [22, 177, 153]
        },
        'breeze': {
            r: [13, 45, 220],
            g: [148, 212, 255],
            b: [136, 191, 240]
        }
    };

    window.themeCanvasColorTransformer = null;

    window.updateCanvasThemeTransformer = (theme) => {
        const map = mappings[theme];
        if (!map) {
            window.themeCanvasColorTransformer = null;
            return;
        }
        window.themeCanvasColorTransformer = (colorStr, isVortex = false) => {
            if (!isVortex) return colorStr;
            if (typeof colorStr !== 'string') return colorStr;
            const match = colorStr.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/i);
            if (match) {
                const r = parseInt(match[1]);
                const g = parseInt(match[2]);
                const b = parseInt(match[3]);
                const alpha = match[4] !== undefined ? parseFloat(match[4]) : 1.0;

                // Decide which tone to pick based on original color intensity
                const intensity = (r + g + b) / 3;
                let idx = 0;
                if (intensity > 210) idx = 1; // Brights
                else if (intensity < 80) idx = 2; // Darks

                const isLightTheme = ['crystal', 'sunset', 'breeze'].includes(theme);

                // Optimization: for Light themes, pure bright items (like particles) must map to
                // their rich primary accents (idx=0) to provide enough visual contrast on bright backgrounds!
                if (isLightTheme && idx === 1) {
                    idx = 0;
                }

                // Light theme adjusts alphas to maintain healthy visibility and extreme soft bokeh
                let finalAlpha = alpha;
                if (isLightTheme && alpha > 0) {
                    if (isVortex) {
                        // Decluttering: delete only the absolute tiniest, noisey background dust
                        if (alpha < 0.06) {
                            return 'transparent';
                        }
                        // Scale remaining visible particles smoothly into soft glowing bubbles!
                        finalAlpha = (alpha - 0.06) * 0.75;
                    } else {
                        // General canvases outside vortex: preserve original opacity perfectly!
                        finalAlpha = alpha;
                    }
                }

                const nr = map.r[idx] !== undefined ? map.r[idx] : map.r[0];
                const ng = map.g[idx] !== undefined ? map.g[idx] : map.g[0];
                const nb = map.b[idx] !== undefined ? map.b[idx] : map.b[0];
                return `rgba(${nr}, ${ng}, ${nb}, ${finalAlpha})`;
            }
            return colorStr;
        };
    };

    // Gradient Tagging - enables addColorStop to check if its gradient belongs to the background vortex!
    const originalRadial = CanvasRenderingContext2D.prototype.createRadialGradient;
    CanvasRenderingContext2D.prototype.createRadialGradient = function (...args) {
        const grad = originalRadial.apply(this, args);
        grad._isVortex = (this.canvas && this.canvas.id === 'vortexCanvas');
        return grad;
    };

    const originalLinear = CanvasRenderingContext2D.prototype.createLinearGradient;
    CanvasRenderingContext2D.prototype.createLinearGradient = function (...args) {
        const grad = originalLinear.apply(this, args);
        grad._isVortex = (this.canvas && this.canvas.id === 'vortexCanvas');
        return grad;
    };

    // Hook addColorStop
    const originalAddColorStop = CanvasGradient.prototype.addColorStop;
    CanvasGradient.prototype.addColorStop = function (offset, color) {
        const newColor = window.themeCanvasColorTransformer ? window.themeCanvasColorTransformer(color, this._isVortex) : color;
        return originalAddColorStop.call(this, offset, newColor);
    };

    // Hook fillStyle
    const originalFillStyle = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'fillStyle');
    if (originalFillStyle) {
        Object.defineProperty(CanvasRenderingContext2D.prototype, 'fillStyle', {
            set: function (val) {
                if (typeof val === 'string') {
                    const isVortex = (this.canvas && this.canvas.id === 'vortexCanvas');
                    val = window.themeCanvasColorTransformer ? window.themeCanvasColorTransformer(val, isVortex) : val;
                }
                originalFillStyle.set.call(this, val);
            },
            get: function () { return originalFillStyle.get.call(this); }
        });
    }

    // Hook strokeStyle
    const originalStrokeStyle = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'strokeStyle');
    if (originalStrokeStyle) {
        Object.defineProperty(CanvasRenderingContext2D.prototype, 'strokeStyle', {
            set: function (val) {
                if (typeof val === 'string') {
                    const isVortex = (this.canvas && this.canvas.id === 'vortexCanvas');
                    val = window.themeCanvasColorTransformer ? window.themeCanvasColorTransformer(val, isVortex) : val;
                }
                originalStrokeStyle.set.call(this, val);
            },
            get: function () { return originalStrokeStyle.get.call(this); }
        });
    }
})();

// 🌍 TRANSLATION PIPELINE
function translateDOM(lang) {
    const dict = TRANSLATIONS[lang];
    if (!dict) return;

    // Apply to Title tag
    if (document.title.includes('Map Maker') && dict['Map Maker']) {
        document.title = document.title.replace('Map Maker', dict['Map Maker']);
    } else if (document.title.includes('My Maps') && dict['My Maps']) {
        document.title = document.title.replace('My Maps', dict['My Maps']);
    }

    // CRITICAL FIX: Reject traversing script and style nodes to prevent breaking CSS and JS functions!
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function (node) {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_ACCEPT;

                const tagName = parent.tagName.toUpperCase();
                if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'CANVAS'].includes(tagName)) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        },
        false
    );

    let node;
    while (node = walker.nextNode()) {
        let val = node.nodeValue;
        const trimmed = val.trim().replace(/\s+/g, ' ');
        if (trimmed && dict[trimmed]) {
            node.nodeValue = val.replace(trimmed, dict[trimmed]);
        }
    }

    // Process specific dynamic slogans on Landing Page
    const heroSlogan = document.getElementById('heroSlogan');
    const heroDesc = document.getElementById('heroDesc');
    if (heroSlogan && heroDesc) {
        const checkAndTranslateSlogan = () => {
            const text = heroSlogan.textContent.trim().replace(/\s+/g, ' ');
            const descText = heroDesc.textContent.trim().replace(/\s+/g, ' ');

            // Look for matches in our dictionary
            for (let key in dict) {
                if (key.length > 10) { // Ensure we're matching full slogans
                    // Match slogan description
                    if (descText.includes(key.substring(0, 20)) && key.includes('editor') || descText === key) {
                        heroDesc.textContent = dict[key];
                    }
                    // Match slogan titles
                    const cleanKey = key.replace('<span class="accent">', '').replace('</span>', '').replace('<br>', ' ');
                    if (text.includes(cleanKey.substring(0, 10)) || text.replace(/\s+/g, ' ').includes('best map-making')) {
                        // Dynamic inject mapped gradient HTML slogan
                        if (dict[key] && (dict[key].includes('<') || key.includes('<'))) {
                            heroSlogan.innerHTML = dict[key];
                        } else if (dict[key]) {
                            heroSlogan.textContent = dict[key];
                        }
                    }
                }
            }
        };
        // Call it immediately and set an observer or short interval since landing page generates it randomly on load
        checkAndTranslateSlogan();
        setTimeout(checkAndTranslateSlogan, 50);
        setTimeout(checkAndTranslateSlogan, 200);
    }

    // Process placeholdlers
    document.querySelectorAll('[placeholder]').forEach(el => {
        const v = el.getAttribute('placeholder');
        if (dict[v]) el.setAttribute('placeholder', dict[v]);
    });

    // Process titles
    document.querySelectorAll('[title]').forEach(el => {
        const v = el.getAttribute('title');
        if (dict[v]) el.setAttribute('title', dict[v]);
    });

    // Process Select Options
    document.querySelectorAll('select option').forEach(opt => {
        const t = opt.textContent.trim();
        if (t.includes('| By:')) {
            const p = t.split('|');
            const themeName = p[0].trim();
            const authorBlock = p[1].trim(); // "By: x"
            const transTheme = dict[themeName] || themeName;
            const transBy = authorBlock.replace('By:', dict['By:'] || 'От:');
            opt.textContent = `${transTheme} | ${transBy}`;
        } else if (dict[t]) {
            opt.textContent = dict[t];
        }
    });
}

// ⚙️ UI & SETTINGS CORE
export function initializeGlobalSettings() {
    const currentTheme = localStorage.getItem('cp_app_theme') || 'space';
    const currentLang = localStorage.getItem('cp_app_lang') || 'en';

    // Sync logo according to active theme
    const syncLogo = () => {
        const logoLink = document.querySelector('.top-bar a.logo, a.logo');
        if (logoLink) {
            const isLightTheme = ['crystal', 'sunset', 'breeze'].includes(currentTheme);
            const logoSrc = isLightTheme 
                ? './Resources/Additional/Icons/compass-white-theme.webp' 
                : './Resources/Additional/Icons/compass-black-theme.webp';
            logoLink.innerHTML = `<img src="${logoSrc}" alt="Compass" class="logo-img-theme">`;
        }
    };
    syncLogo();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncLogo);
    }

    // 1. Set up initial theme
    if (currentTheme !== 'space') {
        document.documentElement.setAttribute('data-theme', currentTheme);
    }
    window.updateCanvasThemeTransformer(currentTheme);

    // 2. Run translation
    if (currentLang !== 'en') {
        // Wait for initial DOM components to render
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => translateDOM(currentLang));
        } else {
            translateDOM(currentLang);
        }
    }

    // 3. Inject Gear Button & Dropdown menu
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => injectSettingsUI(currentTheme, currentLang));
    } else {
        injectSettingsUI(currentTheme, currentLang);
    }
}

function injectSettingsUI(activeTheme, activeLang) {
    const targetBar = document.querySelector('.top-bar-right') || document.getElementById('navLinks');
    if (!targetBar) return;

    // If already injected, skip
    if (document.getElementById('globalSettingsBtn')) return;

    // Create the settings gear button
    const settingsBtn = document.createElement('button');
    settingsBtn.id = 'globalSettingsBtn';
    settingsBtn.className = 'top-bar-settings-btn';
    settingsBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
    `;

    // Definition of Theme Styles for swatches
    const themeConfigs = {
        'space': { color: '#05050a', border: '#a78bfa', text: '#ffffff', glow: 'rgba(167, 139, 250, 0.4)' },
        'sand': { color: '#1b1208', border: '#e6a662', text: '#fcf5ee', glow: 'rgba(230, 166, 98, 0.4)' },
        'sea': { color: '#02121a', border: '#00f0ff', text: '#edfbfc', glow: 'rgba(0, 240, 255, 0.4)' },
        'poison': { color: '#020d03', border: '#39ff14', text: '#f0fff0', glow: 'rgba(57, 255, 20, 0.4)' },
        'gray': { color: '#0f0f11', border: '#ffffff', text: '#fafafa', glow: 'rgba(255, 255, 255, 0.4)' },
        'crystal': { color: '#f3f4f6', border: '#2563eb', text: '#111827', glow: 'rgba(37, 99, 235, 0.3)' },
        'sunset': { color: '#fff2ea', border: '#f97316', text: '#271305', glow: 'rgba(249, 115, 22, 0.3)' },
        'breeze': { color: '#e8faf6', border: '#0d9488', text: '#042f2e', glow: 'rgba(13, 148, 136, 0.3)' }
    };

    // Create styles for the settings button and modal
    const styles = document.createElement('style');
    styles.textContent = `
        .top-bar-settings-btn {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.08);
            color: rgba(255,255,255,0.6);
            width: 32px;
            height: 32px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            margin-left: 0.5rem;
            position: relative;
        }
        .top-bar-settings-btn:hover {
            background: rgba(255,255,255,0.1);
            color: #fff;
            border-color: rgba(255,255,255,0.15);
            transform: rotate(30deg);
        }
        html[data-theme="crystal"] .top-bar-settings-btn,
        html[data-theme="sunset"] .top-bar-settings-btn,
        html[data-theme="breeze"] .top-bar-settings-btn {
            background: rgba(0,0,0,0.05);
            border-color: rgba(0,0,0,0.08);
            color: rgba(0,0,0,0.6);
        }
        html[data-theme="crystal"] .top-bar-settings-btn:hover,
        html[data-theme="sunset"] .top-bar-settings-btn:hover,
        html[data-theme="breeze"] .top-bar-settings-btn:hover {
            background: rgba(0,0,0,0.1);
            color: #000;
        }

        /* Redesigned Premium Dropdown Panel */
        .settings-dropdown {
            position: fixed;
            top: 72px;
            right: 24px;
            background: rgba(15, 15, 27, 0.85);
            backdrop-filter: blur(32px) saturate(2);
            -webkit-backdrop-filter: blur(32px) saturate(2);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 24px;
            width: 280px;
            padding: 1.4rem;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255,255,255,0.05);
            z-index: 100000;
            transform-origin: top right;
            transform: scale(0.92) translateY(-10px);
            opacity: 0;
            pointer-events: none;
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .settings-dropdown.open {
            opacity: 1;
            pointer-events: all;
            transform: scale(1) translateY(0);
        }
        html[data-theme="crystal"] .settings-dropdown,
        html[data-theme="sunset"] .settings-dropdown,
        html[data-theme="breeze"] .settings-dropdown {
            background: rgba(255, 255, 255, 0.92);
            border: 1px solid rgba(0,0,0,0.06);
            box-shadow: 0 20px 50px rgba(0,0,0,0.12);
        }

        .settings-section-title {
            font-size: 0.65rem;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: rgba(255,255,255,0.4);
            font-weight: 800;
            margin-bottom: 0.8rem;
            margin-top: 1.4rem;
        }
        .settings-section-title:first-of-type { margin-top: 0; }
        html[data-theme="crystal"] .settings-section-title,
        html[data-theme="sunset"] .settings-section-title,
        html[data-theme="breeze"] .settings-section-title {
            color: rgba(0,0,0,0.45);
        }

        /* Minimalist 2-Column Swatch Grid */
        .theme-subheading {
            font-size: 0.6rem;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: rgba(255, 255, 255, 0.35);
            font-weight: 800;
            margin-bottom: 0.45rem;
        }
        html[data-theme="crystal"] .theme-subheading,
        html[data-theme="sunset"] .theme-subheading,
        html[data-theme="breeze"] .theme-subheading {
            color: rgba(0, 0, 0, 0.45);
        }

        .theme-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.45rem;
            margin-bottom: 1rem;
        }
        .theme-pill-btn {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 10px;
            padding: 0.5rem 0.6rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            color: rgba(255, 255, 255, 0.7) !important;
            text-align: left;
            width: 100%;
            position: relative;
        }
        .theme-pill-btn:hover {
            background: rgba(255, 255, 255, 0.05);
            border-color: rgba(255, 255, 255, 0.12);
            color: #ffffff !important;
        }
        .theme-pill-btn.active {
            background: rgba(255, 255, 255, 0.06);
            border-color: var(--opt-accent);
            color: #ffffff !important;
            box-shadow: inset 0 0 0 0.5px var(--opt-accent);
        }
        html[data-theme="crystal"] .theme-pill-btn,
        html[data-theme="sunset"] .theme-pill-btn,
        html[data-theme="breeze"] .theme-pill-btn {
            background: rgba(0, 0, 0, 0.02);
            border-color: rgba(0, 0, 0, 0.06);
            color: rgba(0, 0, 0, 0.7) !important;
        }
        html[data-theme="crystal"] .theme-pill-btn:hover,
        html[data-theme="sunset"] .theme-pill-btn:hover,
        html[data-theme="breeze"] .theme-pill-btn:hover {
            background: rgba(0, 0, 0, 0.04);
            color: #000000 !important;
            border-color: rgba(0, 0, 0, 0.15);
        }
        html[data-theme="crystal"] .theme-pill-btn.active,
        html[data-theme="sunset"] .theme-pill-btn.active,
        html[data-theme="breeze"] .theme-pill-btn.active {
            background: rgba(0, 0, 0, 0.04);
            color: #000000 !important;
            border-color: var(--opt-accent);
            box-shadow: inset 0 0 0 0.5px var(--opt-accent);
        }

        .theme-pill-btn .color-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--opt-accent);
            flex-shrink: 0;
            transition: transform 0.2s ease;
        }
        .theme-pill-btn:hover .color-dot {
            transform: scale(1.15);
        }
        .theme-pill-btn .label {
            font-size: 0.72rem;
            font-weight: 700;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            pointer-events: none;
        }
        
        /* Language Buttons Group */
        .lang-buttons {
            display: flex;
            gap: 0.35rem;
        }
        .lang-btn {
            flex: 1;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.08);
            color: rgba(255,255,255,0.6);
            padding: 0.5rem;
            border-radius: 8px;
            font-size: 0.75rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
        }
        .lang-btn:hover {
            background: rgba(255,255,255,0.08);
            color: #fff;
        }
        .lang-btn.active {
            background: rgba(255,255,255,0.15);
            border-color: rgba(255,255,255,0.25);
            color: #fff;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);
        }
        html[data-theme="crystal"] .lang-btn,
        html[data-theme="sunset"] .lang-btn,
        html[data-theme="breeze"] .lang-btn {
            background: rgba(0,0,0,0.04);
            border-color: rgba(0,0,0,0.06);
            color: rgba(0,0,0,0.6);
        }
        html[data-theme="crystal"] .lang-btn:hover,
        html[data-theme="sunset"] .lang-btn:hover,
        html[data-theme="breeze"] .lang-btn:hover {
            background: rgba(0,0,0,0.08);
            color: #000;
        }
        html[data-theme="crystal"] .lang-btn.active,
        html[data-theme="sunset"] .lang-btn.active,
        html[data-theme="breeze"] .lang-btn.active {
            background: var(--accent);
            border-color: var(--accent);
            color: #fff;
        }
        
        @media (max-width: 900px) {
            .settings-dropdown {
                top: auto;
                bottom: 80px;
                right: 20px;
                transform-origin: bottom right;
                width: calc(100% - 40px);
                max-width: 300px;
            }
            .top-bar-settings-btn {
                margin-top: 1rem;
                width: 100%;
                height: 42px;
            }
        }
    `;
    document.head.appendChild(styles);

    // Translate setting strings for the panel itself!
    const dict = TRANSLATIONS[activeLang] || {};
    const textSettings = dict['Settings'] || 'Settings';
    const textTheme = dict['Theme'] || 'Theme';
    const textLanguage = dict['Language'] || 'Language';

    // Inject Gear into bar
    const globalProfile = targetBar.querySelector('.global-user-profile');
    if (globalProfile) {
        targetBar.insertBefore(settingsBtn, globalProfile);
    } else {
        targetBar.appendChild(settingsBtn);
    }

    // Create dropdown content
    const dropdown = document.createElement('div');
    dropdown.id = 'settingsDropdown';
    dropdown.className = 'settings-dropdown';

    // Create visual theme pills grouped by Dark / Light
    const darkThemes = ['space', 'sand', 'sea', 'poison', 'gray'];
    const lightThemes = ['crystal', 'sunset', 'breeze'];

    const textDarkThemes = dict['Dark Themes'] || 'Dark Themes';
    const textLightThemes = dict['Light Themes'] || 'Light Themes';

    let visualThemesHTML = '';

    // Render Dark Themes
    visualThemesHTML += `<div class="theme-subheading">🌑 ${textDarkThemes}</div><div class="theme-grid">`;
    for (let code of darkThemes) {
        let tName = dict[APP_THEMES[code]] || APP_THEMES[code];
        if (activeTheme === code) {
            tName = '● ' + tName;
        }
        const c = themeConfigs[code] || { color: '#111', border: '#999', text: '#fff', glow: 'transparent' };
        const styleBlock = `--opt-bg: ${c.color}; --opt-text: ${c.text}; --opt-accent: ${c.border}; --opt-glow: ${c.glow};`;
        visualThemesHTML += `
            <button class="theme-pill-btn ${activeTheme === code ? 'active' : ''}" 
                    data-theme-code="${code}" style="${styleBlock}">
                <span class="color-dot"></span>
                <span class="label">${tName}</span>
            </button>
        `;
    }
    visualThemesHTML += '</div>';

    // Render Light Themes
    visualThemesHTML += `<div class="theme-subheading">☀️ ${textLightThemes}</div><div class="theme-grid" style="margin-bottom: 0;">`;
    for (let code of lightThemes) {
        let tName = dict[APP_THEMES[code]] || APP_THEMES[code];
        if (activeTheme === code) {
            tName = '● ' + tName;
        }
        const c = themeConfigs[code] || { color: '#111', border: '#999', text: '#fff', glow: 'transparent' };
        const styleBlock = `--opt-bg: ${c.color}; --opt-text: ${c.text}; --opt-accent: ${c.border}; --opt-glow: ${c.glow};`;
        visualThemesHTML += `
            <button class="theme-pill-btn ${activeTheme === code ? 'active' : ''}" 
                    data-theme-code="${code}" style="${styleBlock}">
                <span class="color-dot"></span>
                <span class="label">${tName}</span>
            </button>
        `;
    }
    visualThemesHTML += '</div>';

    const headerColor = ['crystal', 'sunset', 'breeze'].includes(activeTheme) ? '#000' : '#fff';

    dropdown.innerHTML = `
        <div style="font-weight:900; font-size:0.95rem; margin-bottom:1.2rem; display:flex; align-items:center; gap:0.6rem; color: ${headerColor}; letter-spacing: -0.01em;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            ${textSettings}
        </div>
        
        <div class="settings-section-title">${textTheme}</div>
        ${visualThemesHTML}

        <div class="settings-section-title">${textLanguage}</div>
        <div class="lang-buttons">
            <button class="lang-btn ${activeLang === 'en' ? 'active' : ''}" data-lang="en">${activeLang === 'en' ? '● EN' : 'EN'}</button>
            <button class="lang-btn ${activeLang === 'ru' ? 'active' : ''}" data-lang="ru">${activeLang === 'ru' ? '● RU' : 'RU'}</button>
            <button class="lang-btn" style="opacity:0.4;" disabled title="Soon">DE</button>
            <button class="lang-btn" style="opacity:0.4;" disabled title="Soon">FR</button>
        </div>
    `;

    document.body.appendChild(dropdown);

    // Wire toggle functionality
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
    });

    // Close dropdown if clicked outside
    document.addEventListener('click', (e) => {
        if (dropdown.classList.contains('open') && !dropdown.contains(e.target) && !settingsBtn.contains(e.target)) {
            dropdown.classList.remove('open');
        }
    });

    // Handlers for switching themes (Visual Rows)
    dropdown.querySelectorAll('.theme-pill-btn[data-theme-code]').forEach(rowBtn => {
        rowBtn.addEventListener('click', () => {
            const selected = rowBtn.getAttribute('data-theme-code');

            // Update UI active states
            dropdown.querySelectorAll('.theme-pill-btn').forEach(r => r.classList.remove('active'));
            rowBtn.classList.add('active');

            localStorage.setItem('cp_app_theme', selected);

            if (selected === 'space') {
                document.documentElement.removeAttribute('data-theme');
            } else {
                document.documentElement.setAttribute('data-theme', selected);
            }
            window.updateCanvasThemeTransformer(selected);

            // Trigger a soft reload to reset dynamically injected text/canvas elements properly
            // This ensures any hard-cached drawing logic and colors reset perfectly immediately!
            if (activeTheme !== selected) {
                window.location.reload();
            }
        });
    });

    // Handlers for switching language
    dropdown.querySelectorAll('.lang-btn[data-lang]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const selected = btn.getAttribute('data-lang');
            localStorage.setItem('cp_app_lang', selected);
            window.location.reload(); // Clean refresh to re-translate and apply
        });
    });
}
