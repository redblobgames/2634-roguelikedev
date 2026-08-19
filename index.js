/*!
 * From https://www.redblobgames.com/x/2634-roguelike-dev/
 * Copyright 2026 Red Blob Games <redblobgames@gmail.com>
 * @license Apache-2.0 <https://www.apache.org/licenses/LICENSE-2.0.html>
 * SPDX-License-Identifier: Apache-2.0
 */

import { Display, RNG } from "./third-party/rotjs/index.js";

RNG.setSeed(1234);

const screenSize = {x: 80, y: 50};
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
 * @typedef {EntityData & {id: number, type: EntityType, position: Position}} Entity
 */

/** @type{Record<EntityType, EntityData>} */
const ENTITY_DATA = {
    player: {shape: "@", fg: "hsl(60 100% 50%)"},
    troll:  {shape: "T", fg: "hsl(120 60% 50%)"},
    orc:    {shape: "o", fg: "hsl(100 30% 50%)"},
};

let world = {
    _nextEntityId: 1,
    entities: /** @type{Array<Entity>} */([]),
};

/**
 * Creates a game object such as the player, monster, or item.
 *
 * @param {EntityType} type
 * @param {Position} position
 */
function createEntity(type, {x, y}) {
    let id = ++world._nextEntityId;
    let entity = Object.assign(Object.create(ENTITY_DATA[type]), {id, type, position: {x, y}});
    world.entities.push(entity);
    return entity;
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
            player.position.x += action.dx;
            player.position.y += action.dy;
            break;
    }

    drawWorld();
}

/**
 * @param {Entity} entity
 */
function drawCharacter(entity) {
    display.draw(
        entity.position.x, entity.position.y,
        entity.shape, entity.fg,
        "black"
    );
}

let player = createEntity('player', {x: Math.floor(screenSize.x / 2), y: Math.floor(screenSize.y / 2)});
createEntity('troll', {x: 20, y: 10});

function drawWorld() {
    display.clear();
    for (let entity of world.entities) {
        drawCharacter(entity);
    }
}

drawWorld();
