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
document.body.append(display.getContainer());

display.draw(1, 1, "@");
