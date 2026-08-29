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

export function setupInputHandlers(worldGlobal, handleKeyDown) {
    world = worldGlobal;
    const canvas = /** @type{HTMLCanvasElement} */(display.getContainer());
    document.querySelector("#game").append(canvas);

    canvas.setAttribute('tabindex', "1");
    canvas.addEventListener('keydown', handleKeyDown);

    canvas.addEventListener('mousemove', handleMousemove);
    canvas.addEventListener('mouseout', handleMouseout);

    const onBlur= () => focusReminder.classList.toggle('visible', true);
    const onFocus = () => focusReminder.classList.toggle('visible', false);
    const focusReminder = document.getElementById('focus-reminder');
    canvas.addEventListener('blur', onBlur);
    canvas.addEventListener('focus', onFocus);
    canvas.focus();
    if (document.hasFocus() && document.activeElement === canvas) onFocus(); else onBlur();
}

function handleMousemove(event) {
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
}

function handleMouseout(event) {
    showTemporaryMessage("");
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

        display.draw(
            position.x, position.y,
            entity.shape,
            entity.fg.replace(")", ` / ${tile.light})`),
            bgColorAtTile(tile)
        );
    }
}


function formatValue(value) {
    if (value === undefined) return "";
    if (value === null) return "(null)";
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === 'object') {
        return Object.entries(value)
            .map(([key, v]) => `${key}: ${JSON.stringify(v)}`)
            .join(", ");
    }
    return value.toString();
}

/** @type{Element | snabbdom.VNode} */
let drawTableVnode = document.querySelector("#world-entities");
export function drawTable(table) {
    const {h} = snabbdom;
    const types = Object.keys(table.prototypes);

    let vnodeHeader = [];
    for (let column of table.columns) {
        vnodeHeader.push(h('th', column));
    }
    let vnodeRows = [];
    for (let entity of table.rows) {
        let vnodeCols = [];
        for (let column of table.columns) {
            let attrs = {};
            if (!Object.hasOwn(entity, column) && !Object.hasOwn(entity, "__"+column)) {
                let hue = 360 * types.indexOf(entity.type) / types.length;
                attrs = {style: {color: `oklch(65% 0.05 ${hue}deg)`}};
            }
            vnodeCols.push(h('td', attrs, [formatValue(entity[column])]));
        }
        vnodeRows.push(h('tr', vnodeCols));
    }
    let vnodeTable = h("div#world-entities",
        h('table',
            {attrs: {rules: "all", border: "all"}},
            [
                h('thead', h('tr', vnodeHeader)),
                h('tbody', vnodeRows),
            ]
        )
    );
    drawTableVnode = snabbdomPatch(drawTableVnode, vnodeTable);
}


const MAX_MESSAGE_LINES = 100;
let messages = /** @type{Array<string>} */([]); // [html, …]
export function drawMessages() {
    let messageBox = document.querySelector("#messages");
    // If there are more messages than there are <div>s, add some
    while (messageBox.children.length < messages.length) {
        messageBox.appendChild(document.createElement('div'));
    }
    // Remove any extra <div>s
    while (messages.length < messageBox.children.length) {
        messageBox.removeChild(messageBox.lastChild);
    }
    // Update the content
    for (let line = 0; line < messages.length; line++) {
        let div = messageBox.children[line];
        div.innerHTML = messages[line];
    }
    // Scroll to the bottom
    messageBox.scrollTop = messageBox.scrollHeight;
}

function escapeHTML(text) { // wish this was built in
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

export function print(strings, ...values) {
    let html = ``;
    for (let i = 0; i < strings.length; i++) {
        html += escapeHTML(strings[i]);
        if (i < values.length) {
            let v = values[i];
            if (v === world.player) {
                html += `<span class="player" data-entityid="${v.id}">player</span>`;
            } else if (world.entities.object.isPrototypeOf(v)) {
                html += `<span class="entity" data-entityid="${v.id}">${escapeHTML(v.type)}</span>`;
            } else {
                html += `<span class="other">${escapeHTML(v.toString())}</span>`;
            }
        }
    }
    messages.push(html);
    messages.splice(0, messages.length - MAX_MESSAGE_LINES);
    drawMessages();
}

export function showTemporaryMessage(text) {
    let area = document.querySelector("#message-overlay");
    area.textContent = text;
    area.classList.toggle('visible', !!text);
}
