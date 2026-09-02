/*!
 * From https://www.redblobgames.com/x/2634-roguelike-dev/
 * Copyright 2026 Red Blob Games <redblobgames@gmail.com>
 * @license Apache-2.0 <https://www.apache.org/licenses/LICENSE-2.0.html>
 * SPDX-License-Identifier: Apache-2.0
 */

import { RNG, Map as RotMap, FOV } from "./third-party/rotjs/index.js";
import { Table } from "./table.js";
import { print, screenSize, drawWorld, drawTable, drawMessages, setupInputHandlers } from "./interface.js";

RNG.setSeed(1234);
const randint = RNG.getUniformInt.bind(RNG);

/**
 * Determine which action occurs when a key is pressed.
 *
 * @typedef {
       {type: 'move', dx: number, dy: number}
     | {type: 'get'}
     | {type: 'wait'}
     | {type: 'none'}
   } Action
 *
 * @param {KeyboardEvent} event
 * @returns {Action}
 */
function keyToAction(event) {
    // I want to be able to use the numpad whether NumLock is off or
    // on. That requires using event.code.
    const REMAP_NUMPAD = {
        Numpad7: 'Home',
        Numpad8: 'ArrowUp',
        Numpad9: 'PageUp',
        Numpad4: 'ArrowLeft',
        Numpad5: '.',
        Numpad6: 'ArrowRight',
        Numpad1: 'End',
        Numpad2: 'ArrowDown',
        Numpad3: 'PageDown',
    }
    // But for the other keys I want to use event.key, because it
    // honors the current layout.
    const REMAP_VI_KEYS = {
        h: 'ArrowLeft',
        j: 'ArrowDown',
        k: 'ArrowUp',
        l: 'ArrowRight',
        y: 'Home',
        u: 'PageUp',
        b: 'End',
        n: 'PageDown',
    };
    // The main keybindings are using event.key
    /** @type{Record<string, Action>} */
    const KEYMAP = {
        Home:       {type: 'move', dx: -1, dy: -1},
        ArrowUp:    {type: 'move', dx:  0, dy: -1},
        PageUp:     {type: 'move', dx: +1, dy: -1},
        ArrowLeft:  {type: 'move', dx: -1, dy:  0},
        ArrowRight: {type: 'move', dx: +1, dy:  0},
        End:        {type: 'move', dx: -1, dy: +1},
        ArrowDown:  {type: 'move', dx:  0, dy: +1},
        PageDown:   {type: 'move', dx: +1, dy: +1},
        ['.']:      {type: 'wait'},
        g:          {type: 'get'},
    };

    let key = REMAP_NUMPAD[event.code] ?? event.key;
    key = REMAP_VI_KEYS[key] ?? key;
    return KEYMAP[key] ?? {type: 'none'};
}


/**
 * These are factory functions to construct commonly used groups of
 * components. These values are shared among all instances.
 */
let components = {
    fighter(maxHp, defense, attack) {
        return {fighter: {maxHp, defense, attack}};
    },
    enemy(hp, defense, attack) {
        return {blocksMovement: true, ai: ['hostile'], ...this.fighter(hp, defense, attack)};
    },
    holdable() {
        return {blocksMovement: false, holdable: true};
    },
};

/**
 * Stores information about the entire game world
 */
let world; // HACK: circular dependency workaround
world = {
    entities: new Table('Entities', ['location', 'hp', 'inventory'],
        {
            player: {
                shape: "@", fg: "hsl(60 100% 50%)", renderOrder: 1, blocksMovement: false, ...components.fighter(30, 2, 5),
                get inventory() { return world && world.entities.findAll({location: {type: 'held', by: world.player.id}}); },
            },
            corpse: {shape: "%", fg: "hsl(  0 20% 50%)", renderOrder: 9, blocksMovement: false},
            troll:  {shape: "T", fg: "hsl(120 60% 50%)", renderOrder: 2, ...components.enemy(10, 0, 3)},
            orc:    {shape: "o", fg: "hsl(100 30% 50%)", renderOrder: 2, ...components.enemy(16, 1, 4)},
            health_potion: {shape: "!", fg: "rgb(127 0 255)", renderOrder: 3, ...components.holdable(), consumable: {type: 'heal', amount: 4}},
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
    if (!world.player) {
        world.player = world.entities.create('player', {location: playerLocation});
        world.player.hp = world.player.fighter.maxHp;
    } else {
        world.player.location = playerLocation;
    }

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
                let enemy = world.entities.create(type, {location, hp: 0});
                enemy.hp = enemy.fighter.maxHp;
            }
        }
    }

    // Create items in each room
    const maxItemsPerRoom = 2;
    for (let room of rooms) {
        let numItems = randint(0, maxItemsPerRoom);
        for (let i = 0; i < numItems; i++) {
            let x = randint(room.getLeft(), room.getRight()),
                y = randint(room.getTop(), room.getBottom());
            let location = {type: 'map', x, y};
            if (!world.entities.findAny({location})) {
                world.entities.create('health_potion', {location});
            }
        }
    }
}

/**
 * Combat
 */
function handleCombat(attacker, defender) {
    let damage = attacker.fighter.attack - defender.fighter.defense;
    if (damage > 0) {
        defender.hp = Math.max(0, defender.hp - damage);
        // TODO: want to check hp in other places because there could be other reasons it died
        print `${attacker} attacks ${defender} for ${damage} hp.`;
    } else {
        print `${attacker} attacks ${defender} but does no damage.`;
    }
    if (defender.hp === 0) handleDeath(defender);
}

function handleDeath(actor) {
    print `${actor} is dead!`;
    actor.type = 'corpse';
    actor.ai = undefined;
}

/**
 * Attempt to run the action
 * @param {Action} action
 * @returns {boolean} - true if the turn ends
 */
function handlePlayerAction(action) {
    switch (action.type) {
        case 'wait':
            return true;
        case 'get': {
            let candidates = world.entities.findAll({holdable: true, location: {type: 'map', x: world.player.location.x, y: world.player.location.y}});
            if (world.player.inventory.length >= 26) {
                print `You are holding too much.`;
                return false;
            }
            if (candidates.length === 0) {
                print `There is nothing here to pick up.`;
                return false;
            }
            let entity = candidates[0];
            entity.location = {type: 'held', by: world.player.id};
            print `You pick up ${entity}.`;
            return true;
        }
        case 'move': {
            let newX = world.player.location.x + action.dx;
            let newY = world.player.location.y + action.dy;
            let tile = world.tiles.findAny({walkable: true, position: {x: newX, y: newY}});
            if (!tile) return false;

            let blockingEntity = world.entities.findAny({blocksMovement: true, location: {type: 'map', x: newX, y: newY}});
            if (blockingEntity?.fighter) {
                handleCombat(world.player, blockingEntity);
                return true;
            } else if (blockingEntity) {
                console.log(`You cannot walk through ${blockingEntity.type}.`);
                return false;
            } else {
                world.player.location = {type: 'map', x: newX, y: newY};
                return true;
            }
        }
    }

    throw `Unknown action: ${JSON.stringify(action)}`;
}

function walkableTilesAdjacentTo(tile) {
    let results = [];
    for (let [dx, dy] of [[+1, 0], [-1, 0], [0, +1], [0, -1], [-1, -1], [-1, +1], [+1, -1], [+1, +1]]) {
        let position = {x: tile.position.x + dx, y: tile.position.y + dy};
        let next = world.tiles.findAny({position, walkable: true});
        if (next) results.push(next);
    }
    return results;
}

/**
 * @param {{x: number, y: number}} p
 * @param {{x: number, y: number}} q
 * @returns {number} - chebyshev distance
 */
function distanceBetween(p, q) {
    return Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y));
}

function handleAi(enemy) {
    const MIN_VISIBILITY = 0.2;
    if (enemy.ai === undefined) return;
    switch (enemy.ai[0]) {
        case 'hostile':
            // Make sure we're on the map
            if (enemy.location.type !== 'map') return;

            // Make sure the player is visible (assuming bidirectional visibility)
            let enemyAt = world.tiles.findAny({position: {x: enemy.location.x, y: enemy.location.y}});
            if (enemyAt.light < MIN_VISIBILITY) return;

            // Find the adjacent tile closest to the player. This is
            // not as fancy as the logic in the Python tutorial, which
            // runs pathfinding.
            let closestDistance = Infinity;
            let closestNeighbor = null;
            for (let next of walkableTilesAdjacentTo(enemyAt)) {
                // Make sure nothing blocks movement to this tile
                if (world.entities.findAny({blocksMovement: true, location: {type: 'map', x: next.position.x, y: next.position.y}})) continue;

                let distance = distanceBetween(next.position, world.player.location);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestNeighbor = next;
                }
            }
            if (closestNeighbor === null) return;

            if (closestDistance === 0 && world.player.fighter) {
                // Attack the player
                handleCombat(enemy, world.player);
            } else {
                // Move to a tile closer to the player
                enemy.location = {type: 'map', x: closestNeighbor.position.x, y: closestNeighbor.position.y};
            }
            return;
    }
}

/**
 * @param {KeyboardEvent} event
 */
function handleKeyDown(event) {
    function playerDeadState() {
        // The player is dead and can't move around anymore. This is a
        // placeholder until I work on the UI and can display a "game
        // over" message, as well as "new game"
        return;
    }

    function playerAliveState() {
        let action = keyToAction(event);

        // Only preventDefault if we handled the event; otherwise we want
        // the default browser behavior
        if (action.type === 'none') return;
        event.preventDefault();

        if (handlePlayerAction(action)) {
            // let enemies move
            for (let entity of world.entities.findAll({ai: Table.ANY})) {
                handleAi(entity);
            }
            drawAll();
        }
    }

    if (world.player.hp === 0) return playerDeadState()
    else return playerAliveState();
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
    drawWorld(world);
    drawTable(world.entities);
    drawMessages();
}

setupInputHandlers(world, handleKeyDown, drawAll);
generateDungeon();
drawAll();
