import test from 'node:test';
import assert from 'node:assert';
import { Table } from './table.js';

test('Table creates rows with correct ids and prototypes', () => {
    let prototypes = {
        goblin: { hp: 10, ai: 'aggressive' }
    };
    let table = new Table('test', ['position'], prototypes);
    let r1 = table.create('goblin', { position: [0, 0] });
    let r2 = table.create('goblin', { position: [1, 1] });

    assert.strictEqual(r1.id, 1);
    assert.strictEqual(r1.type, 'goblin');
    assert.strictEqual(r1.hp, 10);
    assert.deepStrictEqual(r1.position, [0, 0]);
    assert.strictEqual(r2.id, 2);
});

test('Table indexes unique columns and throws on duplicate', () => {
    let prototypes = { item: { value: 1 } };
    let table = new Table('test', ['position'], prototypes);
    table.create('item', { position: [5, 5] });

    assert.throws(() => {
        table.create('item', { position: [5, 5] });
    });
});

test('Table findAll queries rows by equality and structure', () => {
    let prototypes = {
        actor: { faction: 'enemy' }
    };
    let table = new Table('test', ['position', 'location'], prototypes);
    table.create('actor', { position: [0, 0], location: 'dungeon' });
    table.create('actor', { position: [0, 1], location: 'dungeon' });
    table.create('actor', { position: [5, 5], location: 'town' });

    let results = table.findAll({ location: 'dungeon' });
    assert.strictEqual(results.length, 2);

    let specific = table.findAll({ position: [0, 1] });
    assert.strictEqual(specific.length, 1);
    assert.strictEqual(specific[0].id, 2);
});

test('Table findOne and findAny handle strict cardinality', () => {
    let prototypes = { tile: {} };
    let table = new Table('test', ['position'], prototypes);
    let x = table.create('tile', { position: [1, 1] });

    let found = table.findOne({ position: [1, 1] });
    assert.strictEqual(found.id, 1);
    let y = table.create('tile', { position: [2, 1] });
    assert.throws(() => table.findOne({ type: 'tile' }));
    assert.strictEqual(table.findAny({ position: [9, 9] }), null);
    assert.strictEqual(table.findAny({ position: [1, 1] }), x);
});

test('Table makes static index properties immutable', () => {
    let prototypes = { node: {} };
    let table = new Table('test', ['position'], prototypes);
    let r1 = table.create('node', { position: [2, 2] });

    assert.throws(() => {
        r1.position = [3, 3];
    });
});

test('Table queries check that the column exists', () => {
    let prototypes = { node: {} };
    let table = new Table('test', ['position'], prototypes);
    let r1 = table.create('node', { position: [2, 2] });

    assert.throws(() => {
        table.findAll({nonexistent_column: true});
    });
});

test('Table skips indexing undefined values', () => {
    let prototypes = { node: {} };
    let table = new Table('test', ['position'], prototypes);

    // Insert three rows, but only two should be indexed
    let r1 = table.create('node', {});
    let r2 = table.create('node', {position: 5});
    let r3 = table.create('node', {position: null});

    assert.strictEqual(table.indexes.position.size, 2);
});

test('Table rows can only mutate self columns', () => {
    let prototypes = { kobold: { prototypeColumn: 50 } };
    let table = new Table('entities', ['selfColumn'], prototypes);
    let r1 = table.create('kobold', { selfColumn: 30 });

    r1.selfColumn = 20;
    assert.strictEqual(r1.selfColumn, 20);

    assert.throws(() => {
        r1.prototypeColumn = 50;
    });
    assert.throws(() => {
        r1.nonexistent = 50;
    });
});
