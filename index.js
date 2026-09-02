/*!
 * From https://www.redblobgames.com/x/2634-roguelike-dev/
 * Copyright 2026 Red Blob Games <redblobgames@gmail.com>
 * @license Apache-2.0 <https://www.apache.org/licenses/LICENSE-2.0.html>
 * SPDX-License-Identifier: Apache-2.0
 */

import { RNG, Map as RotMap, FOV } from "./third-party/rotjs/index.js";
import { Table } from "./table.js";
import { print, screenSize, drawAll, handleOverlayInventory, handleOverlayDrop, handleOverlayLook, handleOverlayChooseEnemy, handleOverlayChoosePosition, setupInputHandlers } from "./interface.js";

/**
 * @import { Action } from "./interface.js"
 */

RNG.setSeed(1234);
const randint = RNG.getUniformInt.bind(RNG);

 /**
 * These are factory functions to construct commonly used groups of
 * components. These values are shared among all instances.
 */
let components = {
    fighter(maxHp, defense, attack) {
        return {fighter: {maxHp, defense, attack}};
    },
    enemy(hp, defense, attack) {
        return {blocksMovement: true, ...this.fighter(hp, defense, attack)};
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
    entities: new Table('Entities', ['location', 'hp', 'inventory', 'ai'],
        {
            player: {
                shape: "@", fg: "hsl(60 100% 50%)", renderOrder: 1, blocksMovement: false, ...components.fighter(30, 2, 5),
                get inventory() { return world && world.entities.findAll({location: {type: 'held', by: world.player.id}}); },
            },
            corpse: {shape: "%", fg: "hsl(  0 20% 50%)", renderOrder: 9, blocksMovement: false},
            troll:  {shape: "T", fg: "hsl(120 60% 50%)", renderOrder: 2, ...components.enemy(10, 0, 3)},
            orc:    {shape: "o", fg: "hsl(100 30% 50%)", renderOrder: 2, ...components.enemy(16, 1, 4)},
            health_potion: {shape: "!", fg: "rgb(127 0 255)", renderOrder: 3, ...components.holdable(), consumable: {type: 'heal', amount: 4}},
            lightning_potion: {shape: "~", fg: "rgb(255 255 0)", renderOrder: 3, ...components.holdable(), consumable: {type: 'lightning', damage: 20, range: 5}},
            confusion_scroll: {shape: "~", fg: "rgb(207 63 255)", renderOrder: 3, ...components.holdable(), consumable: {type: 'confusion', turns: 10}},
            fireball_scroll: {shape: "~", fg: "rgb(255 0 0)", renderOrder: 3, ...components.holdable(), consumable: {type: 'fireball', damage: 12, radius: 3}},
        }
    ),
    tiles: new Table('Tiles', ['position', 'light', 'maxLight'],
        {
            floor: {walkable: true,  transparent: true },
            wall:  {walkable: false, transparent: false},
        }
    ),
    player: null,
    fov: new FOV.PreciseShadowcasting((x, y) => world.tiles.findAny({position: {x, y}})?.transparent),
    nextTurn() {
        // let enemies move
        for (let entity of world.entities.findAll({ai: Table.ANY})) {
            handleAi(entity);
        }
        drawAll();
    },

    /**
     * Attempt to run the action
     * @param {Action} action
     * @returns {Promise<boolean>} - true if the turn ends
     */
    async handlePlayerAction(action) {
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
            case 'item': {
                let entity = await handleOverlayInventory.waitForAnswer();
                if (entity === null) {
                    return false; // action cancelled
                }
                return await handleConsumable(entity);
            }
            case 'drop': {
                let entity = await handleOverlayDrop.waitForAnswer();
                if (entity === null) {
                    return false; // action cancelled
                }
                entity.location = {type: 'map', x: world.player.location.x, y: world.player.location.y};
                print `You dropped the ${entity.type}.`;
                return true;
            }
            case 'look': {
                await handleOverlayLook.waitForAnswer();
                return false;
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
    },

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
                let enemy = world.entities.create(type, {location, hp: 0, ai: [{type: 'hostile'}]});
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
                let itemChance = randint(0, 9);
                if (itemChance < 7) {
                    world.entities.create('health_potion', {location});
                } else if (itemChance < 8) {
                    world.entities.create('fireball_scroll', {location});
                } else if (itemChance < 9) {
                    world.entities.create('confusion_scroll', {location});
                } else {
                    world.entities.create('lightning_potion', {location});
                }
            }
        }
    }
}

/**
 * Actions
 */

/**
 * @param {object} entity
 * @param {number} by - can be positive or negative
 * @returns {number} how much hp actually changed
 */
function adjustHealth(entity, by) {
    const maxHp = entity.fighter?.maxHp;
    let newHealth = entity.hp + by;
    if (newHealth < 0) newHealth = 0;
    if (newHealth > maxHp) newHealth = maxHp;
    let change = entity.hp - newHealth;
    entity.hp = newHealth;
    return change;
}

function handleCombat(attacker, defender) {
    let damaged = adjustHealth(defender, -(attacker.fighter.attack - defender.fighter.defense));
    if (damaged > 0) {
        print `${attacker} attacks ${defender} for ${damaged} hp.`;
    } else {
        print `${attacker} attacks ${defender} but does no damage.`;
    }
    checkForDeath(defender);
}

function checkForDeath(actor) {
    if (actor.hp === 0) {
        print `${actor} is dead!`;
        actor.type = 'corpse';
        actor.ai = undefined;
    }
}

async function handleConsumable(entity) {
    switch (entity.consumable.type) {
        case 'heal': {
            let amountRecovered = adjustHealth(world.player, entity.consumable.amount);
            if (amountRecovered === 0) {
                print `Your health is already full.`;
                return false;
            }
            entity.location = {type: 'void'}; // where all used-up things go
            print `You consume the ${entity}, and recover ${amountRecovered} hp!`;
            return true;
        }
        case 'lightning': {
            let closest = {target: null, distance: entity.consumable.range + 1};
            for (let target of world.entities.findAll({fighter: Table.ANY})) {
                if (target === world.player) continue;
                if (target.location.type !== 'map') continue;
                let distance = Math.hypot(target.location.x - world.player.location.x, target.location.y - world.player.location.y);
                if (distance < closest.distance) closest = {target, distance};
            }
            if (!closest.target) {
                print `No enemy is close enough to strike.`
                return false;
            }
            let damaged = adjustHealth(closest.target, -entity.consumable.damage);
            print `A lightning bolt strikes the ${closest.target} with a loud thunder, for ${damaged} damage!`;
            entity.location = {type: 'void'};
            checkForDeath(closest.target);
            return true;
        }
        case 'confusion': {
            print `Select a target location.`;
            let position = await handleOverlayChooseEnemy.waitForAnswer();
            if (!position) return false; // cancelled

            let tile = world.tiles.findAny({position});
            if (tile.light === 0.0) {
                print `You cannot target an area that you cannot see.`;
                return false;
            }
            let target = world.entities.findAny({ai: Table.ANY, location: {type: 'map', x: position.x, y: position.y}});
            if (!target) {
                print `You must select an enemy to target`;
                return false;
            }

            print `The eyes of the ${target} look vacant, as it starts to stumble around!`;
            target.ai.unshift({type: 'confused', turns: entity.consumable.turns});
            return true;
        }
        case 'fireball': {
            print `Select a target location.`;
            let position = await handleOverlayChoosePosition.waitForAnswer({radius: entity.consumable.radius});
            if (!position) return false; // cancelled

            let tile = world.tiles.findAny({position});
            if (tile.light === 0.0) {
                print `You cannot target an area that you cannot see.`;
                return false;
            }

            let targetsHit = false;
            for (let target of world.entities.findAll({ai: Table.ANY})) {
                if (target.location.type === 'map' && distanceBetween(target.location, position) <= entity.consumable.radius) {
                    let damaged = adjustHealth(target, -entity.consumable.damage);
                    print `The ${target} is engulfed in a fiery explosion, taking ${damaged} damage!`;
                    targetsHit = true;
                }
            }
            if (targetsHit) {
                entity.location = {type: 'void'};
                return true;
            }
            print `There are no targets in the radius.`;
            return false;
        }
    }
    throw `Unknown consumable type ${entity.consumable.type}`;
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
    switch (enemy.ai[0].type) {
        case 'confused': {
            if (enemy.ai[0].turns <= 0) {
                print `The ${enemy.type} is no longer confused.`;
                enemy.ai.shift();
            } else {
                // Pick a random direction
                let [dx, dy] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]][randint(0, 7)];
                enemy.ai[0].turns -= 1;
                let location = {type: 'map', x: enemy.location.x + dx, y: enemy.location.y + dy};
                let entity = world.entities.findAny({location});
                if (entity === world.player) { // walked into the player
                    handleCombat(enemy, entity);
                } else if (entity?.blocksMovement) { // walked into an object/enemy
                } else if (world.tiles.findAny({walkable: true, position: {x: location.x, y: location.y}})) { // move to an open tile
                    enemy.location = location;
                } else { // walked into a wall
                }
            }
            break;
        }
        case 'hostile': {
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
            break;
        }
        default:
            throw `Unknown enemy ai ${JSON.stringify(enemy.ai[0])}`;
    }
}

setupInputHandlers(world);
generateDungeon();
drawAll();
