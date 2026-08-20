/*!
 * From https://www.redblobgames.com/x/2634-roguelike-dev/
 * Copyright 2026 Red Blob Games <redblobgames@gmail.com>
 * @license Apache-2.0 <https://www.apache.org/licenses/LICENSE-2.0.html>
 * SPDX-License-Identifier: Apache-2.0
 */

import { Display, RNG, Map as RotMap, FOV } from "./third-party/rotjs/index.js";
import { Table } from "./table.js";

RNG.setSeed(1234);
const randint = RNG.getUniformInt.bind(RNG);

const screenSize = {x: 40, y: 25};
const display = new Display({
    width: screenSize.x,
    height: screenSize.y,
    fontFamily: "Courier Prime",
    fontSize: 18,
});
const canvas = /** @type{HTMLCanvasElement} */(display.getContainer());
document.querySelector("#game").append(canvas);

canvas.setAttribute('tabindex', "1");
canvas.addEventListener('keydown', handleKeyDown);

const focusReminder = document.getElementById('focus-reminder');
canvas.addEventListener('blur', () =>  { focusReminder.style.visibility = 'visible'; });
canvas.addEventListener('focus', () => { focusReminder.style.visibility = 'hidden'; });
canvas.focus();

/**
 * Determine which action occurs when a key is pressed.
 *
 * @typedef {
       {type: 'move', dx: number, dy: number}
     | {type: 'none'}
   } Action
 *
 * @param {KeyboardEvent} event
 * @returns {Action}
 */
function keyToAction(event) {
    /** @type{Action} */
    let action = {type: 'none'};

    if (event.key === 'ArrowRight') { action = {type: 'move', dx: +1, dy: 0}; }
    if (event.key === 'ArrowLeft')  { action = {type: 'move', dx: -1, dy: 0}; }
    if (event.key === 'ArrowDown')  { action = {type: 'move', dx: 0, dy: +1}; }
    if (event.key === 'ArrowUp')    { action = {type: 'move', dx: 0, dy: -1}; }

    return action;
}


/**
 * Stores information about the entire game world
 */
let world = {
    entities: new Table('Entities', ['location'],
        {
            // NOTE: fg must be hsl(h s l) or rgb(r g b) with no alpha
            // because we manipulate the color string elsewhere
            player: {shape: "@", fg: "hsl(60 100% 50%)"},
            troll:  {shape: "T", fg: "hsl(120 60% 50%)"},
            orc:    {shape: "o", fg: "hsl(100 30% 50%)"},
        }
    ),
    tiles: new Table('Tiles', ['position', 'light', 'maxLight'],
        {
            floor: {walkable: true,  transparent: true },
            wall:  {walkable: false, transparent: false},
        }
    ),
    player: null,
};

function generateDungeon() {
    const types = ['floor', 'wall'];
    const digger = new RotMap.Uniform(screenSize.x, screenSize.y, {
        roomWidth: [4, 8],
        roomHeight: [3, 6],
        roomDugPercentage: 70,
        timeLimit: 500,
    });
    digger.create((x, y, contents) =>
        world.tiles.create(types[contents], {position: {x, y}, light: 0, maxLight: 0}));

    let rooms = digger.getRooms();

    // Create the player, or move existing player to this map
    let [playerX, playerY] = rooms[0].getCenter();
    let playerLocation = {type: 'map', x: playerX, y: playerY};
    if (!world.player) world.player = world.entities.create('player', {location: playerLocation})
    else               world.player.location = playerLocation;

    // Create monsters in each room
    const maxMonstersPerRoom = 3;
    for (let room of rooms.slice(1)) { // No monsters in the player's starting room
        let numMonsters = randint(0, maxMonstersPerRoom);
        for (let i = 0; i < numMonsters; i++) {
            let x = randint(room.getLeft(), room.getRight()),
                y = randint(room.getTop(), room.getBottom());
            let location = {type: 'map', x, y};
            if (!world.entities.findAny({location})) {
                let type = randint(0, 3) === 0? 'troll' : 'orc';
                world.entities.create(type, {location});
            }
        }
    }
}

/**
 * @param {KeyboardEvent} event
 */
function handleKeyDown(event) {
    let action = keyToAction(event);

    // Only preventDefault if we handled the event; otherwise we want
    // the default browser behavior
    if (action.type === 'none') return;
    event.preventDefault();

    switch (action.type) {
        case 'move':
            let newX = world.player.location.x + action.dx;
            let newY = world.player.location.y + action.dy;
            let tile = world.tiles.findAny({walkable: true, position: {x: newX, y: newY}});
            if (tile) {
                world.player.location = {type: 'map', x: newX, y: newY};
            }
            break;
    }

    drawAll();
}

function formatValue(value) {
    if (value === null) return "(null)";
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === 'object') {
        return Object.entries(value)
            .map(([key, v]) => `${key}: ${JSON.stringify(v)}`)
            .join(", ");
    }
    return value.toString();
}

const fov = new FOV.PreciseShadowcasting((x, y) => world.tiles.findAny({position: {x, y}})?.transparent);

function drawAll() {
    for (let tile of world.tiles.rows) {
        tile.light = 0;
    }
    fov.compute(world.player.location.x, world.player.location.y, 10,
        (x, y, r, light) => {
        let tile = world.tiles.findAny({position: {x, y}});
        if (tile) {
            tile.light = light;
            tile.maxLight = Math.max(tile.maxLight, light);
        }
    });
    drawWorld();
    drawTable("#world-entities", world.entities);
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

function drawWorld() {
    display.clear();
    for (let tile of world.tiles.rows) {
        // In the 2020 version of the Python tutorial, the tiles are
        // blank and we only need to draw the background color.
        display.draw(tile.position.x, tile.position.y, ' ',
            "purple" /* should never see this */,
            bgColorAtTile(tile)
        );
    }
    for (let entity of world.entities.rows.toReversed()) {
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

function drawTable(selector, table) {
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

generateDungeon();
drawAll();
