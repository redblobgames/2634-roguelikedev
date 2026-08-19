/*!
 * From https://www.redblobgames.com/x/2634-roguelike-dev/
 * Copyright 2026 Red Blob Games <redblobgames@gmail.com>
 * @license Apache-2.0 <https://www.apache.org/licenses/LICENSE-2.0.html>
 * SPDX-License-Identifier: Apache-2.0
 */

import { Display, RNG, Map as RotMap } from "./third-party/rotjs/index.js";

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

    findMaybe(query) {
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
            player: {shape: "@", fg: "hsl(60 100% 50%)"},
            troll:  {shape: "T", fg: "hsl(120 60% 50%)"},
            orc:    {shape: "o", fg: "hsl(100 30% 50%)"},
        }
    ),
    tiles: new Table(
        {},
        {
            floor: {walkable: true,  transparent: true,  shape: '·', fg: "hsl(60 50% 50%)", bg: "black", darkBg: "hsl(240 50% 40%)"},
            wall:  {walkable: false, transparent: false, shape: '#', fg: "hsl(60 10% 40%)", bg: "gray",  darkBg: "hsl(240 100% 20%)"},
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
    digger.create((x, y, contents) => world.tiles.create(types[contents], {position: {x, y}}));
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
            let tile = world.tiles.findMaybe({walkable: true, position: {x: newX, y: newY}});
            if (tile) {
                player.location.x = newX;
                player.location.y = newY;
            }
            break;
    }

    drawAll();
}

function drawCharacter(entity) {
    display.draw(
        entity.location.x, entity.location.y,
        entity.shape, entity.fg,
        "black"
    );
}

function formatValue(value) {
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === 'object') return Object.entries(value).map(([key, v]) => `${key}: ${JSON.stringify(v)}`).join(", ");
    return value.toString();
}

function drawAll() {
    drawWorld();
    drawTable("#world-entities", world.entities);
}

function drawWorld() {
    display.clear();
    for (let tile of world.tiles.rows) {
        display.draw(tile.position.x, tile.position.y, tile.shape, tile.fg, tile.bg);
    }
    for (let entity of world.entities.rows.toReversed()) {
        drawCharacter(entity);
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
