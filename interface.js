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

export const screenSize = {x: 40, y: 25};
const display = new Display({
    width: screenSize.x,
    height: screenSize.y,
    fontFamily: "Courier Prime",
    fontSize: 18,
});

export function setupInputHandlers(handleKeyDown) {
    const canvas = /** @type{HTMLCanvasElement} */(display.getContainer());
    document.querySelector("#game").append(canvas);

    canvas.setAttribute('tabindex', "1");
    canvas.addEventListener('keydown', handleKeyDown);

    const onBlur= () => focusReminder.classList.toggle('visible', true);
    const onFocus = () => focusReminder.classList.toggle('visible', false);
    const focusReminder = document.getElementById('focus-reminder');
    canvas.addEventListener('blur', onBlur);
    canvas.addEventListener('focus', onFocus);
    canvas.focus();
    if (document.hasFocus() && document.activeElement === canvas) onFocus(); else onBlur();
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

export function drawTable(selector, table) {
    let html = `<table rules=all border=all><thead><tr>`;
    for (let column of table.columns) {
        html += `<th>${column}</th>`;
    }
    html += `</tr></thead><tbody>`;
    for (let entity of table.rows) {
        html += `<tr>`;
        for (let column of table.columns) {
            html += `<td>${formatValue(entity[column])}</td>`;
        }
        html += `</tr>`;
    }
    html += `</tbody></table>`;
    document.querySelector(selector).innerHTML = html;
}
