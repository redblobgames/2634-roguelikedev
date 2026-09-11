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
   | {type: 'character'}
   | {type: 'look'}
   | {type: 'quit'}
   | {type: 'stairs'}
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
        c:          {type: 'character'},
        ['/']:      {type: 'look'},
        ['>']:      {type: 'stairs'},
        Escape:     {type: 'quit'},
    };

    let movement = getDirectionFromKey(event);
    if (movement) return {type: 'move', ...movement};
    return KEYMAP[event.key] ?? {type: 'none'};
}

const BG_COLOR = {
    shroud: [0, 0, 0],
    explored: {
        true: [50, 50, 150],
        false: [0, 0, 100],
    },
    visible: {
        true: [200, 180, 50],
        false: [130, 110, 50],
    },
};
const lerp = (a, b, t) => a * (1-t) + b * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function bgColorAtTile(tile) {
    let rgb = lerp3(
        lerp3(
            BG_COLOR.shroud,
            BG_COLOR.explored[tile.walkable],
            tile.maxLight
        ),
        BG_COLOR.visible[tile.walkable],
        tile.light
    );
    return `rgb(${rgb})`;
}
function fgColorAtTile(tile) {
    let rgb = lerp3([0, 0, 0], [255, 255, 255], tile.maxLight);
    return `rgb(${rgb})`;
}

export function drawWorld(world) {
    let player = world.player;
    /** @type{HTMLElement} */(document.querySelector("#health-bar-fg")).style.width = player.fighter ? `${Math.ceil(100*world.player.hp/world.player.fighter.maxHp)}%` : "0";
    document.querySelector("#health-bar-text").textContent = world.player.fighter ?` HP: ${world.player.hp} / ${world.player.fighter.maxHp}` : ` dead `;
    document.querySelector("#current-floor").textContent = `Floor: ${world.floor}`;
    Layer.gameover.updateVisibility();

    display.clear();
    for (let tile of world.tiles.rows) {
        // Because my colors vary smoothly and aren't binary
        // dark/light I'm not storing them in the tile structure.
        display.draw(
            tile.position.x, tile.position.y,
            tile.shape,
            fgColorAtTile(tile),
            bgColorAtTile(tile)
        );
    }
    let sortedEntities = world.entities.rows.toSorted((a, b) => b.renderOrder - a.renderOrder);
    for (let entity of sortedEntities) {
        if (entity.location.type !== 'map') continue;
        let position = {x: entity.location.x, y: entity.location.y};
        let tile = world.tiles.findExactlyOne({position});

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

    function editType(object) {
        if (!object.id) return object.type; // it's a prototype, so this isn't editable
        return h('select',
            {
                on: {
                    change: (e) => {
                        const target = /** @type{HTMLSelectElement} */(e.target);
                        if (!target.checkValidity()) return;
                        object.type = target.value;
                        drawAll();
                    }
                }
            },
            Object.keys(world.entities.readonlyPrototypes)
                .map((value) =>
                    h('option', {props: {value, selected: object.type === value? true : undefined}}, value))
        );
    }

    function editShape(object, value) {
        return h('input', {
            attrs: {type: 'text', required: true, maxlength: 1},
            props: {value},
            on: {
                input: (e) => {
                    const target = /** @type{HTMLInputElement} */(e.target);
                    if (!target.checkValidity()) return;
                    object.shape = target.value;
                    drawAll();
                },
            }
        });
    }

    function editBoolean(object, field) {
        return h('input', {
                attrs: {type: 'checkbox'},
                props: {checked: object[field]},
                on: {
                    input: (e) => {
                        const target = /** @type{HTMLInputElement} */(e.target);
                        object[field] = target.checked;
                        drawAll();
                    }
                },
            });
    }

    function editNumber(object, field) {
        return h('input', {
                attrs: {type: 'number', required: true, min: 0},
                props: {value: object[field]},
                on: {
                    input: (e) => {
                        const target = /** @type{HTMLInputElement} */(e.target);
                        if (!target.checkValidity()) return;
                        object[field] = target.valueAsNumber;
                        drawAll();
                    }
                },
            });
    }
    function editNumberWithLabel(object, field) {
        return h('label', [field, ":", editNumber(object, field)]);
    }

    function editColor(object, value) {
        return h('input', {
            attrs: {type: "color"},
            props: {value, maxlength: 1, pattern: "."},
            on: {
                input: (e) => {
                    const target = /** @type{HTMLInputElement} */(e.target);
                    object.fg = target.value;
                    drawAll();
                }
            },
        });
    }

    function editAi(object, value) {
        // This is tricky because do we allow changing the type? do we allow deleting/adding entries?
        // We could allow editing the text freely like the location editor, but for now let's only
        // allow editing the numeric values
        let children = [];
        for (let i = 0; i < value.length; i++) {
            let ai = value[i];
            if (i > 0) children.push(", ");
            children.push(h('span', [
                ai.type,
                ...Object.entries(ai).map(([k, v]) =>
                    k === 'type'? "" : h('span', [" ", k, ":", editNumber(ai, k)])
                )
            ]));
        }
        return h('span', children);
    }

    function editLocation(object, value) {
        let formatted = value.type === 'map'? `map ${value.x},${value.y}` : value.type === 'held' ? `held by ${value.by}` : `void`;
        return h('input', {
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
                                    object.location = {type: 'map', x, y};
                                    drawAll();
                                }
                                break;
                            case 'held':
                                let id = parseInt(words[2]);
                                if (!world.entities.findAny({id, inventory: Table.ANY})) {
                                    target.setCustomValidity("Not an entity that has an inventory");
                                } else {
                                    object.location = {type: 'held', by: id};
                                    drawAll();
                                }
                                break;
                            case 'void':
                                object.location = {type: 'void'};
                                drawAll();
                        }
                    }
                    target.reportValidity();
                },
            },
        })
    }
    
    function formatValue(object, column, value) {
        if (value === undefined) return "";
        switch (column) {
            case 'id': return value;
            case 'type': return editType(object);
            case 'location': return editLocation(object, value);
            case 'hp': return editNumber(object, 'hp');
            case 'inventory': return value.map(entity => `${entity.type}.${entity.id}`).join(", ") || "(empty)";
            case 'ai': return editAi(object, value);
            case 'shape': return editShape(object, value);
            case 'fg': return editColor(object, value);
            case 'renderOrder': return editNumber(object, 'renderOrder');
            case 'blocksView': return editBoolean(object, 'blocksView');
            case 'blocksMovement': return editBoolean(object, 'blocksMovement');
            case 'level': return h('span', [
                editNumberWithLabel(value, 'level'),
                editNumberWithLabel(value, 'xp'),
            ]);
            case 'fighter': return h('span', [
                editNumberWithLabel(value, 'maxHp'),
                editNumberWithLabel(value, 'defense'),
                editNumberWithLabel(value, 'attack'),
                editNumberWithLabel(value, 'xpGiven'),
            ]);
            case 'holdable': return editBoolean(object, 'holdable');
            case 'consumable': return h('span', [
                value.type, ": ",
                ...Object.keys(value)
                    .filter((k) => typeof value[k] === 'number')
                    .map((k) => editNumberWithLabel(value, k))
            ]);
        }
        return JSON.stringify(value); // fallback if there's no better UI
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



/** @type{Element | snabbdom.VNode} */
let messagesVnode = document.querySelector("#messages");

export function drawMessages() {
    const {h} = snabbdom;
    let vnodeRows = world.messages.map(
        (message) => h('div',
            message.map((m) =>
                (typeof m === 'object')
                    ? h('span', {attrs: {class: m.faction}}, m.text)
                    : h('span', m)
            )
        )
    );
    messagesVnode = snabbdomPatch(messagesVnode, h("div#messages", vnodeRows));

    let element = /** @type{HTMLElement} */(messagesVnode.elm);
    element.scrollTop = element.scrollHeight; // Scroll to the bottom
}

export function showTemporaryMessage(text) {
    let area = document.querySelector("#message-overlay");
    area.textContent = text;
    area.classList.toggle('visible', !!text);
}

/* Event handlers */

function currentEventHandler() {
    for (let layer of Object.values(Layer)) {
        if (layer.visible) return layer;
    }
}

function makeInventoryPicker({el, action, filter}) {
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
                    keys: this.draw(),
                };
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

function makeMapLocationPicker({el, check, draw=null}) {
    return {
        el: document.querySelector(el),
        _waiting: null,
        get visible() { return this._waiting !== null; },
        waitForAnswer(config={}) {
            return new Promise((resolve) => {
                this.el.classList.add('visible');
                this._waiting = {
                    resolve: (answer) => {
                        this.el.classList.remove('visible');
                        resolve(answer);
                    },
                    position: {x: world.player.location.x, y: world.player.location.y},
                    ...config
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
            if (draw) draw.apply(this);
        },
    };
}

export const Layer = {
    mainmenu: {
        _visible: false,
        el: document.querySelector("#main-menu"),
        updateVisibility() {
            this.el.classList.toggle('visible', this.visible);
            let html = `<li><kbd>N</kbd> Play a new game</li>`;
            if (world.saveGame) html += `<li><kbd>C</kbd> Continue last game</li>`;
            this.el.querySelector("ul").innerHTML = html;
        },
        get visible() { return this._visible; },
        set visible(v) { this._visible = v; this.updateVisibility(); },
        handleKeyDown(event) {
            if (event.key === 'c' || event.key === 'n') {
                event.preventDefault();
                this.visible = false;
                if (event.key === 'c') {
                    world.deserialize(world.saveGame);
                } else {
                    world.new();
                }
                drawAll();
            }
        },
    },

    gameover: {
        el: document.querySelector("#game-over"),
        get visible() { return world.player.hp === 0 && !Layer.mainmenu.visible; },
        updateVisibility() { this.el.classList.toggle('visible', this.visible); },
        handleKeyDown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                Layer.mainmenu.visible = true;
                this.updateVisibility();
            }
        },
    },

    inventory: makeInventoryPicker({
        el: "#inventory-use",
        action: "use",
        filter: (entities) => entities.filter((entity) => entity.consumable),
    }),

    drop: makeInventoryPicker({
        el: "#inventory-drop",
        action: "drop",
        filter: (entities) => entities,
    }),

    look: makeMapLocationPicker({
        el: "#look-around",
        check(position) { return true; },
    }),

    chooseEnemy: makeMapLocationPicker({
        el: "#choose-enemy",
        check(position) {
            // NOTE: this duplicates some of the logic in the confusion spell cast code
            let tile = world.tiles.findAny({position});
            if (tile.light === 0.0) return false;
            let target = world.entities.findAny({ai: Table.ANY, location: {type: 'map', x: position.x, y: position.y}});
            return !!target;
        },
    }),

    choosePosition: makeMapLocationPicker({
        el: "#choose-position",
        check(position) {
            let tile = world.tiles.findAny({walkable: true, position});
            return tile && tile.light > 0.0;
        },
        /**
         * @this {any} - 'this' will be the object in makeMapLocationPicker, which isn't named
         */
        draw() {
            if (!this._waiting) return;
            let {position, radius} = this._waiting;
            for (let x = position.x - radius; x <= position.x + radius; x++) {
                for (let y = position.y - radius; y <= position.y + radius; y++) {
                    let tile = world.tiles.findAny({position: {x, y}});
                    if (tile && tile.light > 0.0) {
                        display.drawOver(x, y, null, "white", "red");
                    }
                }
            }
        },
    }),

    levelup: {
        el: document.querySelector("#level-up"),
        _waiting: null,
        get visible() { return this._waiting !== null; },
        waitForAnswer() {
            this.draw();
            return new Promise((resolve) => {
                this.el.classList.add('visible');
                this._waiting = {
                    resolve: (answer) => {
                        this.el.classList.remove('visible');
                        resolve(answer);
                    },
                };
             });
        },
        handleKeyDown(event) {
            let answer = {
                a: {type: 'constitution', by: 20},
                b: {type: 'strength', by: 1},
                c: {type: 'agility', by: 1},
            }[event.key];
            if (answer) {
                event.preventDefault();
                let waiting = this._waiting;
                this._waiting = null;
                waiting.resolve(answer);
            }
        },
        draw() {
            this.el.innerHTML = `<ul>
            <li><kbd>a</kbd> Constitution (+20 HP, from ${world.player.fighter.maxHp})</li>
            <li><kbd>b</kbd> Strength (+1 attack, from ${world.player.fighter.attack})</li>
            <li><kbd>c</kbd> Agility (+1 defense, from ${world.player.fighter.defense})</li>
            </ul>`;
        },
    },

    charactersheet: {
        el: document.querySelector("#character-sheet"),
        _waiting: null,
        get visible() { return this._waiting !== null; },
        waitForAnswer() {
            this.draw();
            return new Promise((resolve) => {
                this.el.classList.add('visible');
                this._waiting = {
                    resolve: (answer) => {
                        this.el.classList.remove('visible');
                        resolve(answer);
                    },
                };
             });
        },
        handleKeyDown(event) {
            event.preventDefault();
            let waiting = this._waiting;
            this._waiting = null;
            waiting.resolve();
        },
        draw() {
            this.el.innerHTML = `<ul>
            <li>Level: ${world.player.level.level}</li>
            <li>XP: ${world.player.level.xp}</li>
            <li>XP for next level: ${world.experienceToNextLevel}</li>
            <li>Attack: ${world.player.fighter.attack}</li>
            <li>Defense: ${world.player.fighter.defense}</li>
            </ul>`;
        },
    },

    default: {
        get visible() { return true; },

        async handleKeyDown(event) {
            let action = keyToAction(event);
            if (action.type === 'none') return;

            event.preventDefault();
            if (await world.handlePlayerAction(action)) {
                await world.nextTurn();
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
    },
};
