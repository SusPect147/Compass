/**
 * EventBus — лёгкая шина событий для внутренней коммуникации движка редактора.
 *
 * Назначение: разрывает прямые зависимости между подсистемами.
 * Вместо того чтобы Input.ts вызывал `this.saveState()` напрямую,
 * он может эмитить событие, на которое подписан History.
 *
 * Это добавление, а не замена — весь существующий код с прямыми
 * вызовами методов продолжает работать.
 *
 * Использование:
 * ```ts
 * // Подписка:
 * editor.events.on('tile:placed', ({ x, y, id }) => console.log(x, y, id));
 *
 * // Отправка:
 * editor.events.emit('tile:placed', { x: 3, y: 5, id: 2 });
 *
 * // Отписка:
 * const handler = ({ x }) => {};
 * editor.events.on('tile:placed', handler);
 * editor.events.off('tile:placed', handler);
 * ```
 */

type EventHandler<T = unknown> = (data: T) => void;

export class EventBus {
    private readonly _listeners: Map<string, Set<EventHandler<any>>>;

    constructor() {
        this._listeners = new Map();
    }

    /**
     * Подписаться на событие.
     * @param event  Имя события (например, 'tile:placed', 'history:saved')
     * @param handler Функция-обработчик
     */
    on<T = unknown>(event: string, handler: EventHandler<T>): this {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event)!.add(handler as EventHandler<any>);
        return this;
    }

    /**
     * Отписаться от события.
     */
    off<T = unknown>(event: string, handler: EventHandler<T>): this {
        this._listeners.get(event)?.delete(handler as EventHandler<any>);
        return this;
    }

    /**
     * Подписаться на событие только один раз — автоматически отпишется после первого вызова.
     */
    once<T = unknown>(event: string, handler: EventHandler<T>): this {
        const wrapper: EventHandler<T> = (data) => {
            handler(data);
            this.off(event, wrapper);
        };
        return this.on(event, wrapper);
    }

    /**
     * Эмитировать событие — вызывает всех подписчиков синхронно.
     * @param event Имя события
     * @param data  Произвольные данные для обработчиков
     */
    emit<T = unknown>(event: string, data?: T): this {
        const handlers = this._listeners.get(event);
        if (!handlers || handlers.size === 0) return this;

        for (const handler of handlers) {
            try {
                handler(data);
            } catch (err) {
                console.error(`[EventBus] Error in handler for "${event}":`, err);
            }
        }
        return this;
    }

    /**
     * Удалить всех слушателей для указанного события (или всех событий).
     */
    clear(event?: string): this {
        if (event) {
            this._listeners.delete(event);
        } else {
            this._listeners.clear();
        }
        return this;
    }

    /**
     * Возвращает количество подписчиков для события (полезно для дебага).
     */
    listenerCount(event: string): number {
        return this._listeners.get(event)?.size ?? 0;
    }
}
