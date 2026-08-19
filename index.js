/*!
 * From https://www.redblobgames.com/x/2634-roguelike-dev/
 * Copyright 2026 Red Blob Games <redblobgames@gmail.com>
 * @license Apache-2.0 <https://www.apache.org/licenses/LICENSE-2.0.html>
 * SPDX-License-Identifier: Apache-2.0
 */

import { Display, RNG } from "./third-party/rotjs/index.js";

RNG.setSeed(1234);

/** Some type definitions
 *
 * @typedef {{x: number, y: number}} Position
 */

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

/** Event handlers
 *
 * @typedef {
       {type: 'move', dx: number, dy: number}
     | {type: 'none'}
   } Action
 */

/**
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
            player.x += action.dx;
            player.y += action.dy;
            break;
    }

    drawWorld();
}

let player = {x: Math.floor(screenSize.x / 2), y: Math.floor(screenSize.y / 2)};

function drawWorld() {
    display.clear();
    display.draw(player.x, player.y, '@', "white", "black");
}

drawWorld();
