/*!
 * From https://www.redblobgames.com/x/2634-roguelike-dev/
 * Copyright 2026 Red Blob Games <redblobgames@gmail.com>
 * @license Apache-2.0 <https://www.apache.org/licenses/LICENSE-2.0.html>
 * SPDX-License-Identifier: Apache-2.0
 */

import { Display, RNG, Map as RotMap, FOV } from "./third-party/rotjs/index.js";

RNG.setSeed(1234);

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
 * Generic table of rows for storing game data (map tiles, world entities)
 *
 * The schema will be the instance properties mapped to a boolean indicating whether they should be indexed.
 * The prototypes will be additional properties looked up with the 'type' as the key. These properties will
 * not be indexed.
 */
class Table {
    constructor(schema, prototypes) {
        this.schema = {
            id: true,
            type: true,
            ...schema,
            ...Object.fromEntries(
                Object.keys(prototypes[Object.keys(prototypes)[0]])
                    .map((key) => [key, false]))
        };
        this.prototypes = prototypes;
        this.columns = Object.keys(this.schema);
        this.blank = Object.fromEntries(this.columns.map((key) => [key, null]));
        this._nextId = 0;
        this.rows = [];
    }

    create(type, init) {
        let id = ++this._nextId;
        let entity = {...this.blank, ...this.prototypes[type], id, type, ...init};
        this.rows.push(entity);
        return entity;
    }

    /**
     * Find rows that match a query
     *
     * @param {Record<string, boolean|number|string|object|array>} query
       contains component names and patterns, and the patterns can be:

         - boolean|number|string -- equality
         - array -- equality for each element (1 level deep)
         - object -- every key/value in the object must be present and equal,
                     but it's ok if the row has additional fields in that component
     */
    findAll(query) {
        return this.rows.filter((row) => {
            for (let [key, pattern] of Object.entries(query)) {
                let testAgainst = row[key];
                if (Array.isArray(pattern)) {
                    if (!Array.isArray(testAgainst)) return false;
                    if (pattern.length !== testAgainst.length) return false;
                    for (let i = 0; i < pattern.length; i++) {
                        if (pattern[i] !== testAgainst[i]) return false;
                    }
                } else if (typeof pattern === 'object') {
                    if (typeof testAgainst !== 'object') return false;
                    for (let [key, value] of Object.entries(pattern)) {
                        if (value !== testAgainst[key]) return false;
                    }
                    return true;
                } else {
                    if (pattern !== testAgainst) return false;
                }
            }
            return true;
        });
    }

    findOne(query) {
        let results = this.findAll(query);
        if (results.length !== 1) throw `findOne() matched ${results.length} rows`;
        return results[0];
    }

    findAny(query) {
        let results = this.findAll(query);
        if (results.length === 0) return null;
        if (results.length !== 1) throw `findMaybe() matched ${results.length} rows`;
        return results[0];
    }

}

/**
 * Stores information about the entire game world
 */
let world = {
    entities: new Table(
        {location: 'position'},
        {
            // NOTE: fg must be hsl(h s l) or rgb(r g b) with no alpha
            // because we manipulate the color string elsewhere
            player: {shape: "@", fg: "hsl(60 100% 50%)"},
            troll:  {shape: "T", fg: "hsl(120 60% 50%)"},
            orc:    {shape: "o", fg: "hsl(100 30% 50%)"},
        }
    ),
    tiles: new Table(
        {},
        {
            floor: {walkable: true,  transparent: true },
            wall:  {walkable: false, transparent: false},
        }
    ),
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
            let newX = player.location.x + action.dx;
            let newY = player.location.y + action.dy;
            let tile = world.tiles.findAny({walkable: true, position: {x: newX, y: newY}});
            if (tile) {
                player.location.x = newX;
                player.location.y = newY;
            }
            break;
    }

    drawAll();
}

function formatValue(value) {
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === 'object') return Object.entries(value).map(([key, v]) => `${key}: ${JSON.stringify(v)}`).join(", ");
    return value.toString();
}

const fov = new FOV.PreciseShadowcasting((x, y) => world.tiles.findAny({position: {x, y}})?.transparent);

function drawAll() {
    for (let tile of world.tiles.rows) {
        tile.light = 0;
    }
    fov.compute(player.location.x, player.location.y, 10, (x, y, r, light) => {
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
let player = world.entities.create('player', {location: {type: 'map', x: Math.floor(screenSize.x / 2), y: Math.floor(screenSize.y / 2)}});
world.entities.create('troll', {location: {type: 'map', x: 20, y: 10}});

drawAll();
