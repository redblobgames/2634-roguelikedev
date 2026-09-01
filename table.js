/*!
 * From https://www.redblobgames.com/x/2634-roguelike-dev/
 * Copyright 2026 Red Blob Games <redblobgames@gmail.com>
 * @license Apache-2.0 <https://www.apache.org/licenses/LICENSE-2.0.html>
 *
 * Generic table of rows for storing game data (map, entities)
 *
 * The columns will be the instance properties mapped to a string
 * describing the type (and UI interface). The prototypes will be
 * additional properties looked up with the 'type' as the key. These
 * properties will not be indexed.
 *
 * Indexable/queryable values in the table can be undefined (for a
 * missing value), primitive (null, boolean, number, string), or array
 * of primitive or plain object with primitive keys. Nested arrays or
 * objects cannot be indexed or queried.
 *
 * For now, the properties of a column (indexing, and later UI style)
 * are based on naming convention.
 */

export class Table {
    static ANY = Symbol('<any>');

    static INDEX = {
        id:       {unique: true,  static: true },
        type:     {unique: false, static: false},
        position: {unique: true,  static: true }, // used with tiles, where only one can be in a location
        location: {unique: false, static: false}, // used with entities, where multiple can be in a location
    };

    /**
     * @param{string} name
     * @param{Array<string>} columns
     * @param{Record<string, object>} prototypes
     */
    constructor(name, columns, prototypes) {
        this.name = name;
        this.object = {}; // the base class underneath all the prototypes
        this.columns = /** @type{Set<string>} */(new Set(['id', 'type', ...columns]));
        this.writablePrototypes = prototypes;
        this.readonlyPrototypes = Object.fromEntries(
            Object.entries(prototypes).map(([type, proto]) => [type, new Proxy(proto, {
                // These will be the object prototypes underneath each
                // row. We don't want them to be editable *through the
                // row* itself. Use writablePrototypes to edit.
                set: (target, prop, value, receiver) => {
                    if (!this.columns.has(this.inverseColumnMap[prop.toString()])) throw `Error: no column ${type}.${prop.toString()} = ${value.toString()}`;
                    Reflect.set(target, prop, value, receiver);
                    return true;
                }
            })]));
        this.prototypeColumns = /** @type{Set<string>} */(new Set());
        for (let prototype of Object.values(prototypes)) {
            Object.setPrototypeOf(prototype, this.object);
            for (let column of Object.keys(prototype)) {
                this.prototypeColumns.add(column);
                Object.freeze(prototype[column]);
            }
        }
        this._nextId = 0;
        this.rows = /** @type{Array<object>} */([]);
        this.indexes = /** @type{Record<string, Map<number|string, Array<object>>>} */({});

        // Construct a prototype object for this table, and backing fields/indices
        const table = this;
        this.columnMap = /** @type{Record<string, string>} */({});
        this.inverseColumnMap = /** @type{Record<string, string>} */({});
        for (let column of this.columns) {
            this.columnMap[column] = column;
            this.inverseColumnMap[column] = column;

            let index = Table.INDEX[column];
            if (index) {
                this.indexes[column] = new Map();
                let internalKey = `__${column}`;
                this.columnMap[column] = internalKey;
                this.inverseColumnMap[internalKey] = column;
                Object.defineProperty(this.object, column, {
                    get() {
                        return this[internalKey];
                    },
                    set(v) {
                        if (index.static) throw `Error: cannot assign immutable ${column}`;
                        if (column === 'type') {
                            if (!prototypes[v]) throw `Error: type must be one of ${Object.keys(prototypes)}`;
                            Object.setPrototypeOf(this, prototypes[v]);
                        }
                        table.#indexDel(column, this);
                        this[internalKey] = v;
                        table.#indexAdd(column, this);
                    },
                });
            } else {
                // Can't use a getter/setter here, because we want the
                // child object to be able to set this
                this.object[column] = undefined;
            }
        }
    }

    create(type, init) {
        if (!this.readonlyPrototypes[type]) throw `Error: type must be one of ${Object.keys(this.readonlyPrototypes)}`;
        let id = ++this._nextId;
        let row= Object.create(null);
        row[this.columnMap.id] = id;
        row[this.columnMap.type] = type;
        for (let column of Object.keys(init)) {
            if (!this.columns.has(column)) throw `Create[${this.name}]: init ${JSON.stringify(init)} has an extraneous key: ${column}`;
            row[this.columnMap[column]] = init[column];
        }
        for (let column of Object.keys(this.indexes)) {
            this.#indexAdd(column, row);
        }
        Object.setPrototypeOf(row, this.readonlyPrototypes[type]);
        this.rows.push(row);
        return row;
    }

    remove(row) {
        let i = this.rows.indexOf(row);
        if (i < 0) throw `Remove[${this.name}]: row ${JSON.stringify(row)} that doesn't exist`;
        for (let column of Object.keys(this.indexes)) {
            this.#indexDel(column, row);
        }
        this.rows.splice(i, 1);
    }

    #indexKey(value) {
        if (value === null) return "(null)";
        if (Array.isArray(value)) return value.map((v) => v.toString()).join("\t");
        if (typeof value === 'object') {
            return Object.entries(value)
                .map(([key, v]) => `${key}: ${v.toString()}`)
                .join("\t");
        }
        return value.toString();
    }

    #indexAdd(column, row) {
        let value = row[this.columnMap[column]];
        if (value === undefined) return;
        if (value !== null && typeof value === 'object') Object.freeze(value); // Must be immutable to index
        let key = this.#indexKey(value);
        let matches = this.indexes[column].get(key);
        if (Table.INDEX[column].unique && matches !== undefined) throw `Adding duplicate key ${key} on unique index ${column} with row ${JSON.stringify(row)} existing ${JSON.stringify(matches)}`;
        if (matches === undefined) {
            matches = [];
            this.indexes[column].set(key, matches);
        }
        matches.push(row);
    }

    #indexDel(column, row) {
        let value = row[this.columnMap[column]];
        if (value === undefined) return;
        let key = this.#indexKey(value);
        let matches = this.indexes[column].get(key);
        let i = matches?.indexOf(row) ?? -1;
        if (i < 0) throw `Removing non-existent key from index ${column} with row ${JSON.stringify(row)}`;
        matches.splice(i, 1);
    }

    /**
     * Find rows that match a query
     *
     * @param {Record<string, boolean|number|string|object|array>} query
       contains component names and patterns, and the patterns can be:

         - boolean|number|string -- equality
         - array -- equality for each element (1 level deep)
         - object -- equality for each key (1 level deep)
     */
    findAll(query) {
        let rows = this.rows;
        for (let [column, pattern] of Object.entries(query)) {
            if (!this.columns.has(column) && !this.prototypeColumns.has(column)) throw `Query of column ${column} doesn't exist on table ${this.name}`;
            if (pattern === Table.ANY) continue; // unimplemented
            let index = this.indexes[column];
            if (!index) continue;
            let key = this.#indexKey(pattern);
            let rowsCandidate = index.get(key);
            if (rowsCandidate && rowsCandidate.length < rows.length) rows = rowsCandidate;
        }
        return rows.filter((row) => {
            for (let [column, pattern] of Object.entries(query)) {
                let testAgainst = row[column];
                if (pattern === Table.ANY) {
                    if (testAgainst == undefined) return false;
                } else if (Array.isArray(pattern)) {
                    if (!Array.isArray(testAgainst)) return false;
                    if (pattern.length !== testAgainst.length) return false;
                    for (let i = 0; i < pattern.length; i++) {
                        if (pattern[i] !== testAgainst[i]) return false;
                    }
                } else if (typeof pattern === 'object') {
                    if (typeof testAgainst !== 'object') return false;
                    if (Object.keys(pattern).length !== Object.keys(testAgainst).length) return false;
                    for (let [k, v] of Object.entries(pattern)) {
                        if (v !== testAgainst[k]) return false;
                    }
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
        if (results.length !== 1) throw `findAny() matched ${results.length} rows`;
        return results[0];
    }
}
