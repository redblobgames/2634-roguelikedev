/*!
 * From https://www.redblobgames.com/x/2634-roguelike-dev/
 * Copyright 2026 Red Blob Games <redblobgames@gmail.com>
 * @license Apache-2.0 <https://www.apache.org/licenses/LICENSE-2.0.html>
 * SPDX-License-Identifier: Apache-2.0
 */

import { Display, RNG } from "./third-party/rotjs/index.js";

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
 * Stores information about the entire game world
 *
 * @typedef {'player'|'troll'|'orc'} EntityType
 * @typedef {{x: number, y: number}} Position
 * @typedef {{shape: string, fg: string}} EntityData
 * @typedef {EntityData & {id: number, type: EntityType, location: Position}} Entity
 * @typedef {'floor'|'wall'} TileType
 * @typedef {{shape: string, fg: string, bg: string, walkable: boolean, transparent: boolean, darkBg: string}} TileData
 * @typedef {TileData & {type: TileType, position: Position}} Tile
 */

/** @type{Record<EntityType, EntityData>} */
const ENTITY_DATA = {
    player: {shape: "@", fg: "hsl(60 100% 50%)"},
    troll:  {shape: "T", fg: "hsl(120 60% 50%)"},
    orc:    {shape: "o", fg: "hsl(100 30% 50%)"},
};

let world = {
    _nextEntityId: 0,
    entities: /** @type{Array<Entity>} */([]),
    tiles: /** @type{Array<Tile>} */([]),
};

/**
 * Creates a game object such as the player, monster, or item.
 *
 * @param {EntityType} type
 * @param {Position} location
 */
function createEntity(type, {x, y}) {
    let id = ++world._nextEntityId;
    let entity = Object.assign(Object.create(ENTITY_DATA[type]), {id, type, location: {x, y}});
    world.entities.push(entity);
    return entity;
}

const TILE_DATA = {
    floor: {walkable: true,  transparent: true,  shape: '·', fg: "hsl(60 50% 50%)", bg: "black", darkBg: "hsl(240 50% 40%)"},
    wall:  {walkable: false, transparent: false, shape: '#', fg: "hsl(60 10% 40%)", bg: "gray",  darkBg: "hsl(240 100% 20%)"},
};

/**
 * Creates the game map
 */
function createTile(type, {x, y}) {
    let tile = Object.assign(Object.create(TILE_DATA[type]), {type, position: {x, y}});
    world.tiles.push(tile);
    return tile;
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
            player.location.x += action.dx;
            player.location.y += action.dy;
            break;
    }

    drawAll();
}

/**
 * @param {Entity} entity
 */
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
    drawTable();
}

function drawWorld() {
    display.clear();
    for (let tile of world.tiles) {
        display.draw(tile.position.x, tile.position.y, tile.shape, tile.fg, tile.bg);
    }
    for (let entity of world.entities) {
        drawCharacter(entity);
    }
}

function drawTable() {
    const columns = ['id', 'type', 'location', 'shape', 'fg'];
    let table = `<table rules=all border=all><thead><tr>`;
    for (let column of columns) {
        table += `<th>${column}</th>`;
    }
    table += `</tr></thead><tbody>`;
    for (let entity of world.entities) {
        table += `<tr>`;
        for (let column of columns) {
            table += `<td>${formatValue(entity[column])}</td>`;
        }
        table += `</tr>`;
    }
    table += `</tbody></table>`;
    document.querySelector("#world-entities").innerHTML = table;
}

let player = createEntity('player', {x: Math.floor(screenSize.x / 2), y: Math.floor(screenSize.y / 2)});
createEntity('troll', {x: 20, y: 10});
drawAll();
