/*!
 * From https://www.redblobgames.com/x/2634-roguelike-dev/
 * Copyright 2026 Red Blob Games <redblobgames@gmail.com>
 * @license Apache-2.0 <https://www.apache.org/licenses/LICENSE-2.0.html>
 * SPDX-License-Identifier: Apache-2.0
 */

import { Display } from "./third-party/rotjs/index.js";

const display = new Display({
    width: 80,
    height: 50,
    fontFamily: "Courier Prime",
    fontSize: 18,
});
const canvas = display.getContainer();
document.querySelector("#game").append(canvas);

display.draw(1, 1, '@');

canvas.setAttribute('tabindex', "1");
canvas.addEventListener('keydown', handleKeyDown);

const focusReminder = document.getElementById('focus-reminder');
canvas.addEventListener('blur', () => { focusReminder.style.visibility = 'visible'; });
canvas.addEventListener('focus', () => { focusReminder.style.visibility = 'hidden'; });
canvas.focus();

function handleKeyDown(event) {
    console.log("Keydown event:", event);
}

