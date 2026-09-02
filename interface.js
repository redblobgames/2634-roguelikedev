/*!
 * From https://www.redblobgames.com/x/2634-roguelike-dev/
 * Copyright 2026 Red Blob Games <redblobgames@gmail.com>
 * @license Apache-2.0 <https://www.apache.org/licenses/LICENSE-2.0.html>
 *
 * Functions for rendering the game and UI to the screen.
 *
 * The game world is in a <canvas> but the other UI aspects will use HTML,
 * largely following the same patterns I used in
 * https://www.redblobgames.com/x/2025-roguelike-dev/
 */

import { Table } from "./table.js";
import { Display } from "./third-party/rotjs/index.js";
import * as snabbdom from "./third-party/snabbdom/index.js";

const snabbdomPatch = snabbdom.init([
    snabbdom.classModule,
    snabbdom.styleModule,
    snabbdom.propsModule,
    snabbdom.attributesModule,
    snabbdom.eventListenersModule,
]);

export const screenSize = {x: 40, y: 25};
const display = new Display({
    width: screenSize.x,
    height: screenSize.y,
    fontFamily: "Courier Prime",
    fontSize: 18,
});

/** @type{any} */
let world = {}; // circular I know but … haven't found a better way

function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

export function setupInputHandlers(worldGlobal) {
    world = worldGlobal;
    const canvas = /** @type{HTMLCanvasElement} */(display.getContainer());
    document.querySelector("#game").append(canvas);

    canvas.setAttribute('tabindex', "1");
    canvas.addEventListener('keydown', (event) => currentEventHandler().handleKeyDown?.(event));
    canvas.addEventListener('mousemove', (event) => currentEventHandler().handleMousemove?.(event));
    canvas.addEventListener('mouseout', (event) => currentEventHandler().handleMouseout?.(event));
    canvas.addEventListener('click', (event) => currentEventHandler().handleClick?.(event));

    const onBlur= () => focusReminder.classList.toggle('visible', true);
    const onFocus = () => focusReminder.classList.toggle('visible', false);
    const focusReminder = document.getElementById('focus-reminder');
    canvas.addEventListener('blur', onBlur);
    canvas.addEventListener('focus', onFocus);
    canvas.focus();
    if (document.hasFocus() && document.activeElement === canvas) onFocus(); else onBlur();
}

/**
 * @param {KeyboardEvent} event
 * @returns {null | {dx: number, dy: number}}
 */
function getDirectionFromKey(event) {
    // I want to be able to use the numpad whether NumLock is off or
    // on. That requires using event.code.
    const REMAP_NUMPAD = {
        Numpad7: 'Home',
        Numpad8: 'ArrowUp',
        Numpad9: 'PageUp',
        Numpad4: 'ArrowLeft',
        Numpad6: 'ArrowRight',
        Numpad1: 'End',
        Numpad2: 'ArrowDown',
        Numpad3: 'PageDown',
    };
    // But for the other keys I want to use event.key, because it
    // honors the current layout.
    const REMAP_VI_KEYS = {
        h:       'ArrowLeft',
        j:       'ArrowDown',
        k:       'ArrowUp',
        l:       'ArrowRight',
        y:       'Home',
        u:       'PageUp',
        b:       'End',
        n:       'PageDown',
    };
    const KEYMAP = {
        Home:       {dx: -1, dy: -1},
        ArrowUp:    {dx:  0, dy: -1},
        PageUp:     {dx: +1, dy: -1},
        ArrowLeft:  {dx: -1, dy:  0},
        ArrowRight: {dx: +1, dy:  0},
        End:        {dx: -1, dy: +1},
        ArrowDown:  {dx:  0, dy: +1},
        PageDown:   {dx: +1, dy: +1},
    };

    let key = REMAP_NUMPAD[event.code] ?? event.key;
    key = REMAP_VI_KEYS[key] ?? key;
    return KEYMAP[key] ?? null;
}


/**
 * Determine which action occurs when a key is pressed.
 *
 * @typedef {
       {type: 'move', dx: number, dy: number}
     | {type: 'get'}
     | {type: 'wait'}
     | {type: 'item'}
     | {type: 'drop'}
     | {type: 'look'}
     | {type: 'none'}
   } Action
 *
 * @param {KeyboardEvent} event
 * @returns {Action}
 */
function keyToAction(event) {
    // The main keybindings are using event.key
    /** @type{Record<string, Action>} */
    const KEYMAP = {
        ['.']:      {type: 'wait'},
        g:          {type: 'get'},
        i:          {type: 'item'},
        d:          {type: 'drop'},
        ['/']:      {type: 'look'},
    };

    let movement = getDirectionFromKey(event);
    if (movement) return {type: 'move', ...movement};
    return KEYMAP[event.key] ?? {type: 'none'};
}

const BG_COLOR = {
    shroud: [0, 0, 0],
    explored: {
        floor: [50, 50, 150],
        wall: [0, 0, 100],
    },
    visible: {
        floor: [200, 180, 50],
        wall: [130, 110, 50],
    },
};
const lerp = (a, b, t) => a * (1-t) + b * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function bgColorAtTile(tile) {
    let rgb = lerp3(
        lerp3(
            BG_COLOR.shroud,
            BG_COLOR.explored[tile.type],
            tile.maxLight
        ),
        BG_COLOR.visible[tile.type],
        tile.light
    );
    return `rgb(${rgb})`;
}


export function drawWorld(world) {
    let player = world.player;
    /** @type{HTMLElement} */(document.querySelector("#health-bar-fg")).style.width = player.fighter ? `${Math.ceil(100*world.player.hp/world.player.fighter.maxHp)}%` : "0";
    document.querySelector("#health-bar-text").textContent = world.player.fighter ?` HP: ${world.player.hp} / ${world.player.fighter.maxHp}` : ` Player is dead! `;

    display.clear();
    for (let tile of world.tiles.rows) {
        // In the 2020 version of the Python tutorial, the tiles are
        // blank and we only need to draw the background color.
        display.draw(tile.position.x, tile.position.y, ' ',
            "purple" /* should never see this */,
            bgColorAtTile(tile)
        );
    }
    let sortedEntities = world.entities.rows.toSorted((a, b) => b.renderOrder - a.renderOrder);
    for (let entity of sortedEntities) {
        if (entity.location.type !== 'map') continue;
        let position = {x: entity.location.x, y: entity.location.y};
        let tile = world.tiles.findOne({position});

        if (tile.light > 0.1) {
            display.draw(
                position.x, position.y,
                entity.shape,
                entity.fg,
                bgColorAtTile(tile)
            );
        }
    }
    // TODO: if the player is standing on something, display that somewhere in the UI,
    // and then move the "click for keyboard focus" instructions to be on top of that instead
    // of on top of the health bar
}


/** @type{Element | snabbdom.VNode} */
let drawTableVnode = document.querySelector("#world-entities");
export function drawTable(table) {
    const {h} = snabbdom;
    const types = Object.keys(table.readonlyPrototypes);

    function formatValue(entity, column, value) {
        if (value === undefined) return "";
        switch (column) {
            case 'location':
                let formatted = value.type === 'map'? `map ${value.x},${value.y}` : value.type === 'held' ? `held by ${value.by}` : `void`;
                return h('span',
                    h('input', {
                        attrs: {type: 'text', required: true},
                        props: {value: formatted, pattern: "(map \\d+,\\d+|held by \\d+|void)"},
                        on: {
                            input: (e) => {
                                const target = /** @type{HTMLInputElement} */(e.target);
                                target.setCustomValidity("");
                                if (!target.checkValidity()) {
                                    target.setCustomValidity("Enter [map $x,$y] OR [held by $id] OR [void]");
                                } else {
                                    let words = target.value.split(" ");
                                    switch (words[0]) {
                                        case 'map':
                                            let [x, y] = words[1].split(",").map((word) => parseInt(word));
                                            if (!world.tiles.findAny({walkable: true, position: {x, y}})) {
                                                target.setCustomValidity("Not a walkable tile");
                                            } else {
                                                entity.location = {type: 'map', x, y};
                                                drawAll();
                                            }
                                            break;
                                        case 'held':
                                            let id = parseInt(words[2]);
                                            if (!world.entities.findAny({id, inventory: Table.ANY})) {
                                                target.setCustomValidity("Not an entity that has an inventory");
                                            } else {
                                                entity.location = {type: 'held', by: id};
                                                drawAll();
                                            }
                                            break;
                                        case 'void':
                                            entity.location = {type: 'void'};
                                            drawAll();
                                    }
                                }
                                target.reportValidity();
                            },
                        },
                    }),
                );
            case 'fg': return h('input', {
                attrs: {type: "color"},
                props: {value},
                on: {
                    input: (e) => {
                        const target = /** @type{HTMLInputElement} */(e.target);
                        entity.fg = target.value;
                        drawAll();
                    }
                },
            });
            case 'ai': return value.map((ai) =>
                "{" + Object.entries(ai).map(([k, v]) => `${k}: ${v}`).join(", ") + "}"
            ).join(" ");
            case 'id': return value;
            case 'type': return value;
            case 'renderOrder': return value;
            case 'inventory': return value.map(entity => `${entity.type}.${entity.id}`).join(", ");
            case 'hp': return h('input', {
                attrs: {type: 'number', required: true, min: 0, max: entity.fighter?.maxHp ?? 0},
                props: {value},
                on: {
                    input: (e) => {
                        const target = /** @type{HTMLInputElement} */(e.target);
                        if (!target.checkValidity()) return;
                        entity.hp = target.valueAsNumber;
                        drawAll();
                    }
                },
            });
        }
        if (value === null) return "(null)";
        if (Array.isArray(value)) return JSON.stringify(value);
        if (typeof value === 'object') {
            // TODO: we could make the strings and numbers editable here
            return Object.entries(value)
                .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                .join(", ");
        }
        return value.toString();
    }

    let vnodeHeader1 = [];
    for (let column of table.columns) {
        vnodeHeader1.push(h('th', column));
    }
    let vnodeRows1 = [];
    for (let entity of table.rows) {
        let vnodeCols = [];
        for (let column of table.columns) {
            vnodeCols.push(h('td', formatValue(entity, column, entity[column])));
        }
        vnodeRows1.push(h('tr', vnodeCols));
    }

    let vnodeHeader2 = [h('th', "type")];
    for (let column of table.prototypeColumns.difference(table.columns)) {
        vnodeHeader2.push(h('th', column));
    }
    let vnodeRows2 = [];
    for (let [type, prototype] of Object.entries(table.writablePrototypes)) {
        let vnodeCols = [h('th', type)];
        for (let column of table.prototypeColumns.difference(table.columns)) {
            vnodeCols.push(h('td', formatValue(prototype, column, prototype[column])));
        }
        vnodeRows2.push(h('tr', vnodeCols));
    }

    let vnodeTable = [
        h('table',
            {attrs: {rules: "all", border: "all"}},
            [
                h('thead', h('tr', vnodeHeader1)),
                h('tbody', vnodeRows1),
            ]
        ),
        h('table',
            {attrs: {rules: "all", border: "all"}},
            [
                h('thead', h('tr', vnodeHeader2)),
                h('tbody', vnodeRows2),
            ]
        ),
    ];

    drawTableVnode = snabbdomPatch(drawTableVnode, h("div#world-entities", vnodeTable));
}

export function drawAll() {
    for (let tile of world.tiles.rows) {
        tile.light = 0;
    }
    world.fov.compute(world.player.location.x, world.player.location.y, 10,
        (x, y, r, light) => {
        let tile = world.tiles.findAny({position: {x, y}});
        if (tile) {
            tile.light = light;
            tile.maxLight = Math.max(tile.maxLight, light);
        }
    });
    drawWorld(world);
    drawTable(world.entities);
    drawMessages();
}


const MAX_MESSAGE_LINES = 100;
/** @type{Array<Array<[snabbdom.VNodeData | null, snabbdom.VNodeChildren]>>} */
let messages = [];
/** @type{Element | snabbdom.VNode} */
let messagesVnode = document.querySelector("#messages");

export function drawMessages() {
    const {h} = snabbdom;
    let vnodeRows = messages.map(
        (message) => h('div',
            message.map((m) =>
                h('span', m[0], m[1]))
        )
    );
    messagesVnode = snabbdomPatch(messagesVnode, h("div#messages", vnodeRows));

    let element = /** @type{HTMLElement} */(messagesVnode.elm);
    element.scrollTop = element.scrollHeight; // Scroll to the bottom
}

export function print(strings, ...values) {
    const {h} = snabbdom;
    /** @type{Array<[any, snabbdom.VNodeChildren]>} */
    let message = [];
    for (let i = 0; i < strings.length; i++) {
        message.push([null, strings[i]]);
        if (i < values.length) {
            let v = values[i];
            if (v === world.player) {
                message.push([
                    {attrs: {class: "player"}, dataset: {entityid: v.id}},
                    "player"
                ]);
            } else if (world.entities.object.isPrototypeOf(v)) {
                message.push([
                    {attrs: {class: "entity"}, dataset: {entityid: v.id}},
                    v.type
                ]);
            } else {
                message.push([
                    {attrs: {class: "other"}},
                    v.toString()
                ]);
            }
        }
    }
    messages.push(message);
    messages.splice(0, messages.length - MAX_MESSAGE_LINES);
    drawMessages();
}

export function showTemporaryMessage(text) {
    let area = document.querySelector("#message-overlay");
    area.textContent = text;
    area.classList.toggle('visible', !!text);
}

/* Event handlers */

function currentEventHandler() {
    for (let handler of [handlePlayerDead, handleOverlayLook, handleOverlayDrop, handleOverlayInventory, handleOverlayChooseEnemy]) {
        if (handler.visible) return handler;
    }
    return handleGameMap;
}

const handlePlayerDead = {
    get visible() { return world.player.hp === 0; }
}

const handleGameMap = {
    async handleKeyDown(event) {
        let action = keyToAction(event);
        if (action.type === 'none') return;

        event.preventDefault();
        if (await world.handlePlayerAction(action)) {
            world.nextTurn();
        }
    },

    handleMousemove(event) {
        let [x, y] = display.eventToPosition(event); // returns -1, -1 for out of bounds
        let tile = world.tiles.findAny({position: {x, y}});
        let text = "";
        if (tile && tile.light >= 0.2) {
            let entities = world.entities
                .findAll({location: {type: 'map', x, y}})
                .toSorted((a, b) => b.renderOrder - a.renderOrder);
            text = entities.map(e => e.type + " " + e.id).join("\n");
        }
        showTemporaryMessage(text);
    },

    handleMouseout(event) {
        showTemporaryMessage("");
    }
};

function makeInventoryPicker({el, action, filter}) {
    return {
        el: document.querySelector(el),
        _waiting: null,
        get visible() { return this._waiting !== null; },
        waitForAnswer() {
            return new Promise((resolve) => {
                this.el.classList.add('visible');
                this._waiting = {resolve: (answer) => {
                    this.el.classList.remove('visible');
                    resolve(answer);
                }, keys: this.draw()};
            });
        },
        handleKeyDown(event) {
            if (event.key === 'Escape' || this._waiting.keys.has(event.key.toUpperCase())) {
                let waiting = this._waiting;
                let answer = event.key === 'Escape'? null : waiting.keys.get(event.key.toUpperCase());
                event.preventDefault();
                this._waiting = null;
                waiting.resolve(answer);
            }
        },
        draw() {
            let keys = new Map();
            let html = ``;
            let entities = filter(world.player.inventory)
            if (world.player.inventory.length === 0) {
                html = `<div>Your inventory is empty. Press <kbd>ESC</kbd> to cancel.</div>${html}`;
            } else if (entities.length === 0) {
                html = `<div>You have nothing you can ${action}. Press <kbd>ESC</kbd> to cancel.</div>${html}`;
            } else {
                html = `<ul>`;
                entities.forEach((entity, i) => {
                    let key = String.fromCharCode(65 + i);
                    keys.set(key, entity);
                    html += `<li><kbd>${key}</kbd> ${entity.type}.${entity.id}</li>`;
                });
                html += `</ul>`;
                html = `<div>Select an item to ${action} it, or <kbd>ESC</kbd> to cancel.</div>${html}`;
            }
            this.el.innerHTML = html;
            return keys;
        },
    };
}

function makeMapLocationPicker({el, check}) {
    return {
        el: document.querySelector(el),
        _waiting: null,
        get visible() { return this._waiting !== null; },
        waitForAnswer() {
            return new Promise((resolve) => {
                this.el.classList.add('visible');
                this._waiting = {
                    resolve: (answer) => {
                        this.el.classList.remove('visible');
                        resolve(answer);
                    },
                    position: {x: world.player.location.x, y: world.player.location.y},
                };
                this.draw();
            });
        },
        handleKeyDown(event) {
            let waiting = this._waiting;
            let movement = getDirectionFromKey(event);
            if (movement) {
                event.preventDefault();
                let step = event.shiftKey ? 5 : event.ctrlKey ? 10 : event.altKey ? 20 : 1;
                let position = {
                    x: clamp(waiting.position.x + step * movement.dx, 0, screenSize.x - 1),
                    y: clamp(waiting.position.y + step * movement.dy, 0, screenSize.y - 1),
                };
                this._waiting.position = position;
                this.draw();
                return;
            }
            if (event.key === 'Escape' || event.key === 'Enter') {
                event.preventDefault();
                let answer = event.key === 'Enter'? waiting.position : null;
                this._waiting = null;
                this.draw();
                waiting.resolve(answer);
            }
        },
        handleMousemove(event) {
            let [x, y] = display.eventToPosition(event); // returns -1, -1 for out of bounds
            if (x < 0 || y < 0) return false;
            this._waiting.position = {x, y};
            this.draw();
            return true;
        },
        handleClick(event) {
            let waiting = this._waiting;
            let clickValid = this.handleMousemove(event);
            this._waiting = null;
            this.draw();
            waiting.resolve(clickValid ? waiting.position : null);
        },
        draw() {
            drawAll();
            if (this._waiting) {
                display.drawOver(
                    this._waiting.position.x, this._waiting.position.y,
                    null,
                    "black",
                    check(this._waiting.position) ? "cyan" : "white"
                );
            }
        },
    };
}


export let handleOverlayInventory = makeInventoryPicker({
    el: "#inventory-use",
    action: "use",
    filter: (entities) => entities.filter((entity) => entity.consumable),
});

export let handleOverlayDrop = makeInventoryPicker({
    el: "#inventory-drop",
    action: "drop",
    filter: (entities) => entities,
});

export let handleOverlayLook = makeMapLocationPicker({
    el: "#look-around",
    check(position) { return true; },
});

export let handleOverlayChooseEnemy = makeMapLocationPicker({
    el: "#choose-enemy",
    check(position) {
        // NOTE: this duplicates some of the logic in the confusion spell cast code
        let tile = world.tiles.findAny({position});
        if (tile.light === 0.0) return false;
        let target = world.entities.findAny({ai: Table.ANY, location: {type: 'map', x: position.x, y: position.y}});
        return !!target;
    },
});
