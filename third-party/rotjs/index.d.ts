/**
 * This code is an implementation of Alea algorithm; (C) 2010 Johannes Baagøe.
 * Alea is licensed according to the http://en.wikipedia.org/wiki/MIT_License.
 */
declare class RNG {
    _seed: number;
    _s0: number;
    _s1: number;
    _s2: number;
    _c: number;
    getSeed(): number;
    /**
     * Seed the number generator
     */
    setSeed(seed: number): this;
    /**
     * @returns Pseudorandom value [0,1), uniformly distributed
     */
    getUniform(): number;
    /**
     * @param lowerBound The lower end of the range to return a value from, inclusive
     * @param upperBound The upper end of the range to return a value from, inclusive
     * @returns Pseudorandom value [lowerBound, upperBound], using ROT.RNG.getUniform() to distribute the value
     */
    getUniformInt(lowerBound: number, upperBound: number): number;
    /**
     * @param mean Mean value
     * @param stddev Standard deviation. ~95% of the absolute values will be lower than 2*stddev.
     * @returns A normally distributed pseudorandom value
     */
    getNormal(mean?: number, stddev?: number): number;
    /**
     * @returns Pseudorandom value [1,100] inclusive, uniformly distributed
     */
    getPercentage(): number;
    /**
     * @returns Randomly picked item, null when length=0
     */
    getItem<T>(array: Array<T>): T | null;
    /**
     * @returns New array with randomized items
     */
    shuffle<T>(array: Array<T>): T[];
    /**
     * @param data key=whatever, value=weight (relative probability)
     * @returns whatever
     */
    getWeightedValue(data: {
        [key: string]: number;
        [key: number]: number;
    }): string | undefined;
    /**
     * Get RNG state. Useful for storing the state and re-setting it via setState.
     * @returns Internal state
     */
    getState(): number[];
    /**
     * Set a previously retrieved state.
     */
    setState(state: number[]): this;
    /**
     * Returns a cloned RNG
     */
    clone(): RNG;
}
declare const _default$5: RNG;

declare type LayoutType = "hex" | "rect" | "tile" | "tile-gl" | "term";
interface DisplayOptions {
    width: number;
    height: number;
    transpose: boolean;
    layout: LayoutType;
    fontSize: number;
    spacing: number;
    border: number;
    forceSquareRatio: boolean;
    fontFamily: string;
    fontStyle: string;
    fg: string;
    bg: string;
    tileWidth: number;
    tileHeight: number;
    tileMap: {
        [key: string]: [number, number];
    };
    tileSet: null | HTMLCanvasElement | HTMLImageElement | HTMLVideoElement | ImageBitmap;
    tileColorize: Boolean;
}
declare type DisplayData = [number, number, string | string[] | null, string, string];

/**
 * @class Abstract display backend module
 * @private
 */
declare abstract class Backend {
    _options: DisplayOptions;
    getContainer(): HTMLElement | null;
    setOptions(options: DisplayOptions): void;
    abstract schedule(cb: () => void): void;
    abstract clear(): void;
    abstract draw(data: DisplayData, clearBefore: boolean): void;
    abstract computeSize(availWidth: number, availHeight: number): [number, number];
    abstract computeFontSize(availWidth: number, availHeight: number): number;
    abstract eventToPosition(x: number, y: number): [number, number];
}

declare abstract class Canvas extends Backend {
    _ctx: CanvasRenderingContext2D;
    constructor();
    schedule(cb: () => void): void;
    getContainer(): HTMLCanvasElement;
    setOptions(opts: DisplayOptions): void;
    clear(): void;
    eventToPosition(x: number, y: number): [number, number];
    abstract _normalizedEventToPosition(x: number, y: number): [number, number];
    abstract _updateSize(): void;
}

/**
 * @class Hexagonal backend
 * @private
 */
declare class Hex extends Canvas {
    _spacingX: number;
    _spacingY: number;
    _hexSize: number;
    constructor();
    draw(data: DisplayData, clearBefore: boolean): void;
    computeSize(availWidth: number, availHeight: number): [number, number];
    computeFontSize(availWidth: number, availHeight: number): number;
    _normalizedEventToPosition(x: number, y: number): [number, number];
    /**
     * Arguments are pixel values. If "transposed" mode is enabled, then these two are already swapped.
     */
    _fill(cx: number, cy: number): void;
    _updateSize(): void;
}

/**
 * @class Rectangular backend
 * @private
 */
declare class Rect extends Canvas {
    _spacingX: number;
    _spacingY: number;
    _canvasCache: {
        [key: string]: HTMLCanvasElement;
    };
    _options: DisplayOptions;
    static cache: boolean;
    constructor();
    setOptions(options: DisplayOptions): void;
    draw(data: DisplayData, clearBefore: boolean): void;
    _drawWithCache(data: DisplayData): void;
    _drawNoCache(data: DisplayData, clearBefore: boolean): void;
    computeSize(availWidth: number, availHeight: number): [number, number];
    computeFontSize(availWidth: number, availHeight: number): number;
    _normalizedEventToPosition(x: number, y: number): [number, number];
    _updateSize(): void;
}

/**
 * @class Tile backend
 * @private
 */
declare class Tile extends Canvas {
    _colorCanvas: HTMLCanvasElement;
    constructor();
    draw(data: DisplayData, clearBefore: boolean): void;
    computeSize(availWidth: number, availHeight: number): [number, number];
    computeFontSize(): number;
    _normalizedEventToPosition(x: number, y: number): [number, number];
    _updateSize(): void;
}

/**
 * @class Tile backend
 * @private
 */
declare class TileGL extends Backend {
    _gl: WebGLRenderingContext;
    _program: WebGLProgram;
    _uniforms: {
        [key: string]: WebGLUniformLocation | null;
    };
    static isSupported(): boolean;
    constructor();
    schedule(cb: () => void): void;
    getContainer(): HTMLCanvasElement;
    setOptions(opts: DisplayOptions): void;
    draw(data: DisplayData, clearBefore: boolean): void;
    clear(): void;
    computeSize(availWidth: number, availHeight: number): [number, number];
    computeFontSize(): number;
    eventToPosition(x: number, y: number): [number, number];
    _initWebGL(): WebGLRenderingContext;
    _normalizedEventToPosition(x: number, y: number): [number, number];
    _updateSize(): void;
    _updateTexture(tileSet: HTMLImageElement): void;
}

declare class Term extends Backend {
    _offset: [number, number];
    _cursor: [number, number];
    _lastColor: string;
    constructor();
    schedule(cb: () => void): void;
    setOptions(options: DisplayOptions): void;
    clear(): void;
    draw(data: DisplayData, clearBefore: boolean): void;
    computeFontSize(): number;
    eventToPosition(x: number, y: number): [number, number];
    computeSize(): [number, number];
}

/**
 * @class Visual map display
 */
declare class Display {
    _data: {
        [pos: string]: DisplayData;
    };
    _dirty: boolean | {
        [pos: string]: boolean;
    };
    _options: DisplayOptions;
    _backend: Backend;
    static Rect: typeof Rect;
    static Hex: typeof Hex;
    static Tile: typeof Tile;
    static TileGL: typeof TileGL;
    static Term: typeof Term;
    constructor(options?: Partial<DisplayOptions>);
    /**
     * Debug helper, ideal as a map generator callback. Always bound to this.
     * @param {int} x
     * @param {int} y
     * @param {int} what
     */
    DEBUG(x: number, y: number, what: number): void;
    /**
     * Clear the whole display (cover it with background color)
     */
    clear(): void;
    /**
     * @see ROT.Display
     */
    setOptions(options: Partial<DisplayOptions>): this;
    /**
     * Returns currently set options
     */
    getOptions(): DisplayOptions;
    /**
     * Returns the DOM node of this display
     */
    getContainer(): HTMLElement | null;
    /**
     * Compute the maximum width/height to fit into a set of given constraints
     * @param {int} availWidth Maximum allowed pixel width
     * @param {int} availHeight Maximum allowed pixel height
     * @returns {int[2]} cellWidth,cellHeight
     */
    computeSize(availWidth: number, availHeight: number): [number, number];
    /**
     * Compute the maximum font size to fit into a set of given constraints
     * @param {int} availWidth Maximum allowed pixel width
     * @param {int} availHeight Maximum allowed pixel height
     * @returns {int} fontSize
     */
    computeFontSize(availWidth: number, availHeight: number): number;
    computeTileSize(availWidth: number, availHeight: number): number[];
    /**
     * Convert a DOM event (mouse or touch) to map coordinates. Uses first touch for multi-touch.
     * @param {Event} e event
     * @returns {int[2]} -1 for values outside of the canvas
     */
    eventToPosition(e: TouchEvent | MouseEvent): [number, number];
    /**
     * @param {int} x
     * @param {int} y
     * @param {string || string[]} ch One or more chars (will be overlapping themselves)
     * @param {string} [fg] foreground color
     * @param {string} [bg] background color
     */
    draw(x: number, y: number, ch: string | string[] | null, fg: string | null, bg: string | null): void;
    /**
     * @param {int} x
     * @param {int} y
     * @param {string || string[]} ch One or more chars (will be overlapping themselves)
     * @param {string || null} [fg] foreground color
     * @param {string || null} [bg] background color
     */
    drawOver(x: number, y: number, ch: string | null, fg: string | null, bg: string | null): void;
    /**
     * Draws a text at given position. Optionally wraps at a maximum length. Currently does not work with hex layout.
     * @param {int} x
     * @param {int} y
     * @param {string} text May contain color/background format specifiers, %c{name}/%b{name}, both optional. %c{}/%b{} resets to default.
     * @param {int} [maxWidth] wrap at what width?
     * @returns {int} lines drawn
     */
    drawText(x: number, y: number, text: string, maxWidth?: number): number;
    /**
     * Timer tick: update dirty parts
     */
    _tick(): void;
    /**
     * @param {string} key What to draw
     * @param {bool} clearBefore Is it necessary to clean before?
     */
    _draw(key: string, clearBefore: boolean): void;
}

interface Options$7 {
    /** Use word mode? */
    words: boolean;
    /** Order, default = 3 */
    order: number;
    /** Prior value, default = 0.001 */
    prior: number;
}
declare type Events = {
    [key: string]: number;
};
/**
 * @class (Markov process)-based string generator.
 * Copied from a <a href="http://roguebasin.com/index.php/Names_from_a_high_order_Markov_Process_and_a_simplified_Katz_back-off_scheme">RogueBasin article</a>.
 * Offers configurable order and prior.
 */
declare class StringGenerator {
    _options: Options$7;
    _boundary: string;
    _suffix: string;
    _prefix: string[];
    _priorValues: {
        [key: string]: number;
    };
    _data: {
        [key: string]: Events;
    };
    constructor(options: Partial<Options$7>);
    /**
     * Remove all learning data
     */
    clear(): void;
    /**
     * @returns {string} Generated string
     */
    generate(): string;
    /**
     * Observe (learn) a string from a training set
     */
    observe(string: string): void;
    getStats(): string;
    /**
     * @param {string}
     * @returns {string[]}
     */
    _split(str: string): string[];
    /**
     * @param {string[]}
     * @returns {string}
     */
    _join(arr: string[]): string;
    /**
     * @param {string[]} context
     * @param {string} event
     */
    _observeEvent(context: string[], event: string): void;
    /**
     * @param {string[]}
     * @returns {string}
     */
    _sample(context: string[]): string;
    /**
     * @param {string[]}
     * @returns {string[]}
     */
    _backoff(context: string[]): string[];
}

interface HeapWrapper<T> {
    key: number;
    timestamp: number;
    value: T;
}
declare class MinHeap<T> {
    private heap;
    private timestamp;
    constructor();
    lessThan(a: HeapWrapper<T>, b: HeapWrapper<T>): boolean;
    shift(v: number): void;
    len(): number;
    push(value: T, key: number): void;
    pop(): HeapWrapper<T>;
    find(v: T): HeapWrapper<T> | null;
    remove(v: T): boolean;
    private parentNode;
    private leftChildNode;
    private rightChildNode;
    private existNode;
    private swap;
    private minNode;
    private updateUp;
    private updateDown;
    debugPrint(): void;
}

declare class EventQueue<T = any> {
    _time: number;
    _events: MinHeap<T>;
    /**
     * @class Generic event queue: stores events and retrieves them based on their time
     */
    constructor();
    /**
     * @returns {number} Elapsed time
     */
    getTime(): number;
    /**
     * Clear all scheduled events
     */
    clear(): this;
    /**
     * @param {?} event
     * @param {number} time
     */
    add(event: T, time: number): void;
    /**
     * Locates the nearest event, advances time if necessary. Returns that event and removes it from the queue.
     * @returns {? || null} The event previously added by addEvent, null if no event available
     */
    get(): T | null;
    /**
     * Get the time associated with the given event
     * @param {?} event
     * @returns {number} time
     */
    getEventTime(event: T): number | undefined;
    /**
     * Remove an event from the queue
     * @param {?} event
     * @returns {bool} success?
     */
    remove(event: T): boolean;
}

declare class Scheduler<T = any> {
    _queue: EventQueue<T>;
    _repeat: T[];
    _current: any;
    /**
     * @class Abstract scheduler
     */
    constructor();
    /**
     * @see ROT.EventQueue#getTime
     */
    getTime(): number;
    /**
     * @param {?} item
     * @param {bool} repeat
     */
    add(item: T, repeat: boolean): this;
    /**
     * Get the time the given item is scheduled for
     * @param {?} item
     * @returns {number} time
     */
    getTimeOf(item: T): number | undefined;
    /**
     * Clear all items
     */
    clear(): this;
    /**
     * Remove a previously added item
     * @param {?} item
     * @returns {bool} successful?
     */
    remove(item: any): boolean;
    /**
     * Schedule next item
     * @returns {?}
     */
    next(): any;
}

/**
 * @class Simple fair scheduler (round-robin style)
 */
declare class Simple<T = any> extends Scheduler<T> {
    add(item: any, repeat: boolean): this;
    next(): any;
}

interface SpeedActor {
    getSpeed: () => number;
}
/**
 * @class Speed-based scheduler
 */
declare class Speed<T extends SpeedActor = SpeedActor> extends Scheduler<T> {
    /**
     * @param {object} item anything with "getSpeed" method
     * @param {bool} repeat
     * @param {number} [time=1/item.getSpeed()]
     * @see ROT.Scheduler#add
     */
    add(item: T, repeat: boolean, time?: number): this;
    /**
     * @see ROT.Scheduler#next
     */
    next(): any;
}

/**
 * @class Action-based scheduler
 * @augments ROT.Scheduler
 */
declare class Action<T = any> extends Scheduler<T> {
    _defaultDuration: number;
    _duration: number;
    constructor();
    /**
     * @param {object} item
     * @param {bool} repeat
     * @param {number} [time=1]
     * @see ROT.Scheduler#add
     */
    add(item: T, repeat: boolean, time?: number): this;
    clear(): this;
    remove(item: T): boolean;
    /**
     * @see ROT.Scheduler#next
     */
    next(): any;
    /**
     * Set duration for the active item
     */
    setDuration(time: number): this;
}

declare const _default$4: {
    Simple: typeof Simple;
    Speed: typeof Speed;
    Action: typeof Action;
};

interface LightPassesCallback {
    (x: number, y: number): boolean;
}
interface VisibilityCallback {
    (x: number, y: number, r: number, visibility: number): void;
}
interface Options$6 {
    topology: 4 | 6 | 8;
}
declare abstract class FOV {
    _lightPasses: LightPassesCallback;
    _options: Options$6;
    /**
     * @class Abstract FOV algorithm
     * @param {function} lightPassesCallback Does the light pass through x,y?
     * @param {object} [options]
     * @param {int} [options.topology=8] 4/6/8
     */
    constructor(lightPassesCallback: LightPassesCallback, options?: Partial<Options$6>);
    /**
     * Compute visibility for a 360-degree circle
     * @param {int} x
     * @param {int} y
     * @param {int} R Maximum visibility radius
     * @param {function} callback
     */
    abstract compute(x: number, y: number, R: number, callback: VisibilityCallback): void;
    /**
     * Return all neighbors in a concentric ring
     * @param {int} cx center-x
     * @param {int} cy center-y
     * @param {int} r range
     */
    _getCircle(cx: number, cy: number, r: number): number[][];
}

/**
 * @class Discrete shadowcasting algorithm. Obsoleted by Precise shadowcasting.
 * @augments ROT.FOV
 */
declare class DiscreteShadowcasting extends FOV {
    compute(x: number, y: number, R: number, callback: VisibilityCallback): void;
    /**
     * @param {int} A start angle
     * @param {int} B end angle
     * @param {bool} blocks Does current cell block visibility?
     * @param {int[][]} DATA shadowed angle pairs
     */
    _visibleCoords(A: number, B: number, blocks: boolean, DATA: number[]): boolean;
}

declare type Arc = [number, number];
/**
 * @class Precise shadowcasting algorithm
 * @augments ROT.FOV
 */
declare class PreciseShadowcasting extends FOV {
    compute(x: number, y: number, R: number, callback: VisibilityCallback): void;
    /**
     * @param {int[2]} A1 arc start
     * @param {int[2]} A2 arc end
     * @param {bool} blocks Does current arc block visibility?
     * @param {int[][]} SHADOWS list of active shadows
     */
    _checkVisibility(A1: Arc, A2: Arc, blocks: boolean, SHADOWS: Arc[]): number;
}

/**
 * @class Recursive shadowcasting algorithm
 * Currently only supports 4/8 topologies, not hexagonal.
 * Based on Peter Harkins' implementation of Björn Bergström's algorithm described here: http://www.roguebasin.com/index.php?title=FOV_using_recursive_shadowcasting
 * @augments ROT.FOV
 */
declare class RecursiveShadowcasting extends FOV {
    /**
     * Compute visibility for a 360-degree circle
     * @param {int} x
     * @param {int} y
     * @param {int} R Maximum visibility radius
     * @param {function} callback
     */
    compute(x: number, y: number, R: number, callback: VisibilityCallback): void;
    /**
     * Compute visibility for a 180-degree arc
     * @param {int} x
     * @param {int} y
     * @param {int} R Maximum visibility radius
     * @param {int} dir Direction to look in (expressed in a ROT.DIRS value);
     * @param {function} callback
     */
    compute180(x: number, y: number, R: number, dir: number, callback: VisibilityCallback): void;
    /**
     * Compute visibility for a 90-degree arc
     * @param {int} x
     * @param {int} y
     * @param {int} R Maximum visibility radius
     * @param {int} dir Direction to look in (expressed in a ROT.DIRS value);
     * @param {function} callback
     */
    compute90(x: number, y: number, R: number, dir: number, callback: VisibilityCallback): void;
    /**
     * Render one octant (45-degree arc) of the viewshed
     * @param {int} x
     * @param {int} y
     * @param {int} octant Octant to be rendered
     * @param {int} R Maximum visibility radius
     * @param {function} callback
     */
    _renderOctant(x: number, y: number, octant: number[], R: number, callback: VisibilityCallback): void;
    /**
     * Actually calculates the visibility
     * @param {int} startX The starting X coordinate
     * @param {int} startY The starting Y coordinate
     * @param {int} row The row to render
     * @param {float} visSlopeStart The slope to start at
     * @param {float} visSlopeEnd The slope to end at
     * @param {int} radius The radius to reach out to
     * @param {int} xx
     * @param {int} xy
     * @param {int} yx
     * @param {int} yy
     * @param {function} callback The callback to use when we hit a block that is visible
     */
    _castVisibility(startX: number, startY: number, row: number, visSlopeStart: number, visSlopeEnd: number, radius: number, xx: number, xy: number, yx: number, yy: number, callback: VisibilityCallback): void;
}

declare const _default$3: {
    DiscreteShadowcasting: typeof DiscreteShadowcasting;
    PreciseShadowcasting: typeof PreciseShadowcasting;
    RecursiveShadowcasting: typeof RecursiveShadowcasting;
};

interface CreateCallback {
    (x: number, y: number, contents: number): any;
}
declare abstract class Map {
    _width: number;
    _height: number;
    /**
     * @class Base map generator
     * @param {int} [width=ROT.DEFAULT_WIDTH]
     * @param {int} [height=ROT.DEFAULT_HEIGHT]
     */
    constructor(width?: number, height?: number);
    abstract create(callback?: CreateCallback): void;
    _fillMap(value: number): number[][];
}

/**
 * @class Simple empty rectangular room
 * @augments ROT.Map
 */
declare class Arena extends Map {
    create(callback: CreateCallback): this;
}

interface RoomOptions {
    roomWidth: [number, number];
    roomHeight: [number, number];
}
interface CorridorOptions {
    corridorLength: [number, number];
}
interface DigCallback {
    (x: number, y: number, value: number): void;
}
interface TestPositionCallback {
    (x: number, y: number): boolean;
}
/**
 * @class Dungeon feature; has own .create() method
 */
declare abstract class Feature {
    abstract isValid(isWallCallback: TestPositionCallback, canBeDugCallback: TestPositionCallback): boolean;
    abstract create(digCallback: DigCallback): void;
    abstract debug(): void;
}
/**
 * @class Room
 * @augments ROT.Map.Feature
 * @param {int} x1
 * @param {int} y1
 * @param {int} x2
 * @param {int} y2
 * @param {int} [doorX]
 * @param {int} [doorY]
 */
declare class Room$2 extends Feature {
    _x1: number;
    _y1: number;
    _x2: number;
    _y2: number;
    _doors: {
        [key: string]: number;
    };
    constructor(x1: number, y1: number, x2: number, y2: number, doorX?: number, doorY?: number);
    /**
     * Room of random size, with a given doors and direction
     */
    static createRandomAt(x: number, y: number, dx: number, dy: number, options: RoomOptions): Room$2;
    /**
     * Room of random size, positioned around center coords
     */
    static createRandomCenter(cx: number, cy: number, options: RoomOptions): Room$2;
    /**
     * Room of random size within a given dimensions
     */
    static createRandom(availWidth: number, availHeight: number, options: RoomOptions): Room$2;
    addDoor(x: number, y: number): this;
    /**
     * @param {function}
     */
    getDoors(cb: (x: number, y: number) => void): this;
    clearDoors(): this;
    addDoors(isWallCallback: TestPositionCallback): this;
    debug(): void;
    isValid(isWallCallback: TestPositionCallback, canBeDugCallback: TestPositionCallback): boolean;
    /**
     * @param {function} digCallback Dig callback with a signature (x, y, value). Values: 0 = empty, 1 = wall, 2 = door. Multiple doors are allowed.
     */
    create(digCallback: DigCallback): void;
    getCenter(): number[];
    getLeft(): number;
    getRight(): number;
    getTop(): number;
    getBottom(): number;
}
/**
 * @class Corridor
 * @augments ROT.Map.Feature
 * @param {int} startX
 * @param {int} startY
 * @param {int} endX
 * @param {int} endY
 */
declare class Corridor extends Feature {
    _startX: number;
    _startY: number;
    _endX: number;
    _endY: number;
    _endsWithAWall: boolean;
    constructor(startX: number, startY: number, endX: number, endY: number);
    static createRandomAt(x: number, y: number, dx: number, dy: number, options: CorridorOptions): Corridor;
    debug(): void;
    isValid(isWallCallback: TestPositionCallback, canBeDugCallback: TestPositionCallback): boolean;
    /**
     * @param {function} digCallback Dig callback with a signature (x, y, value). Values: 0 = empty.
     */
    create(digCallback: DigCallback): boolean;
    createPriorityWalls(priorityWallCallback: (x: number, y: number) => void): void;
}

/**
 * @class Dungeon map: has rooms and corridors
 * @augments ROT.Map
 */
declare abstract class Dungeon extends Map {
    _rooms: Room$2[];
    _corridors: Corridor[];
    constructor(width: number, height: number);
    /**
     * Get all generated rooms
     * @returns {ROT.Map.Feature.Room[]}
     */
    getRooms(): Room$2[];
    /**
     * Get all generated corridors
     * @returns {ROT.Map.Feature.Corridor[]}
     */
    getCorridors(): Corridor[];
}

interface Options$5 {
    roomWidth: [number, number];
    roomHeight: [number, number];
    roomDugPercentage: number;
    timeLimit: number;
}
declare type Point$2 = [number, number];
/**
 * @class Dungeon generator which tries to fill the space evenly. Generates independent rooms and tries to connect them.
 * @augments ROT.Map.Dungeon
 */
declare class Uniform extends Dungeon {
    _options: Options$5;
    _roomAttempts: number;
    _corridorAttempts: number;
    _connected: Room$2[];
    _unconnected: Room$2[];
    _map: number[][];
    _dug: number;
    constructor(width: number, height: number, options: Partial<Options$5>);
    /**
     * Create a map. If the time limit has been hit, returns null.
     * @see ROT.Map#create
     */
    create(callback?: CreateCallback): this | null;
    /**
     * Generates a suitable amount of rooms
     */
    _generateRooms(): void;
    /**
     * Try to generate one room
     */
    _generateRoom(): Room$2 | null;
    /**
     * Generates connectors between rooms
     * @returns {bool} success Was this attempt successful?
     */
    _generateCorridors(): boolean;
    /**
     * For a given room, find the closest one from the list
     */
    _closestRoom(rooms: Room$2[], room: Room$2): Room$2 | null;
    _connectRooms(room1: Room$2, room2: Room$2): boolean;
    _placeInWall(room: Room$2, dirIndex: number): Point$2 | null;
    /**
     * Dig a polyline.
     */
    _digLine(points: Point$2[]): void;
    _digCallback(x: number, y: number, value: number): void;
    _isWallCallback(x: number, y: number): boolean;
    _canBeDugCallback(x: number, y: number): boolean;
}

interface Options$4 {
    born: number[];
    survive: number[];
    topology: 4 | 6 | 8;
}
interface ConnectionCallback {
    (from: Point$1, to: Point$1): void;
}
declare type Point$1 = [number, number];
declare type PointMap = {
    [key: string]: Point$1;
};
/**
 * @class Cellular automaton map generator
 * @augments ROT.Map
 * @param {int} [width=ROT.DEFAULT_WIDTH]
 * @param {int} [height=ROT.DEFAULT_HEIGHT]
 * @param {object} [options] Options
 * @param {int[]} [options.born] List of neighbor counts for a new cell to be born in empty space
 * @param {int[]} [options.survive] List of neighbor counts for an existing  cell to survive
 * @param {int} [options.topology] Topology 4 or 6 or 8
 */
declare class Cellular extends Map {
    _options: Options$4;
    _dirs: number[][];
    _map: number[][];
    constructor(width: number, height: number, options?: Partial<Options$4>);
    /**
     * Fill the map with random values
     * @param {float} probability Probability for a cell to become alive; 0 = all empty, 1 = all full
     */
    randomize(probability: number): this;
    /**
     * Change options.
     * @see ROT.Map.Cellular
     */
    setOptions(options: Partial<Options$4>): void;
    set(x: number, y: number, value: number): void;
    create(callback?: CreateCallback): void;
    _serviceCallback(callback: CreateCallback): void;
    /**
     * Get neighbor count at [i,j] in this._map
     */
    _getNeighbors(cx: number, cy: number): number;
    /**
     * Make sure every non-wall space is accessible.
     * @param {function} callback to call to display map when do
     * @param {int} value to consider empty space - defaults to 0
     * @param {function} callback to call when a new connection is made
     */
    connect(callback: CreateCallback, value: number, connectionCallback?: ConnectionCallback): void;
    /**
     * Find random points to connect. Search for the closest point in the larger space.
     * This is to minimize the length of the passage while maintaining good performance.
     */
    _getFromTo(connected: PointMap, notConnected: PointMap): Point$1[];
    _getClosest(point: Point$1, space: PointMap): Point$1;
    _findConnected(connected: PointMap, notConnected: PointMap, stack: Point$1[], keepNotConnected: boolean, value: number): void;
    _tunnelToConnected(to: Point$1, from: Point$1, connected: PointMap, notConnected: PointMap, value: number, connectionCallback?: ConnectionCallback): void;
    _tunnelToConnected6(to: Point$1, from: Point$1, connected: PointMap, notConnected: PointMap, value: number, connectionCallback?: ConnectionCallback): void;
    _freeSpace(x: number, y: number, value: number): boolean;
    _pointKey(p: Point$1): string;
}

interface Options$3 {
    roomWidth: [number, number];
    roomHeight: [number, number];
    corridorLength: [number, number];
    dugPercentage: number;
    timeLimit: number;
}
/**
 * Random dungeon generator using human-like digging patterns.
 * Heavily based on Mike Anderson's ideas from the "Tyrant" algo, mentioned at
 * http://roguebasin.com/index.php/Dungeon-Building_Algorithm
 */
declare class Digger extends Dungeon {
    _options: Options$3;
    _featureAttempts: number;
    _map: number[][];
    _walls: {
        [key: string]: number;
    };
    _dug: number;
    _features: {
        [key: string]: number;
    };
    constructor(width: number, height: number, options?: Partial<Options$3>);
    create(callback?: CreateCallback): this;
    _digCallback(x: number, y: number, value: number): void;
    _isWallCallback(x: number, y: number): boolean;
    _canBeDugCallback(x: number, y: number): boolean;
    _priorityWallCallback(x: number, y: number): void;
    _firstRoom(): void;
    /**
     * Get a suitable wall
     */
    _findWall(): string | null;
    /**
     * Tries adding a feature
     * @returns {bool} was this a successful try?
     */
    _tryFeature(x: number, y: number, dx: number, dy: number): boolean;
    _removeSurroundingWalls(cx: number, cy: number): void;
    /**
     * Returns vector in "digging" direction, or false, if this does not exist (or is not unique)
     */
    _getDiggingDirection(cx: number, cy: number): number[] | null;
    /**
     * Find empty spaces surrounding rooms, and apply doors.
     */
    _addDoors(): void;
}

/**
 * Maze generator - Eller's algorithm
 * See http://homepages.cwi.nl/~tromp/maze.html for explanation
 */
declare class EllerMaze extends Map {
    create(callback: CreateCallback): this;
}

declare type Room$1 = [number, number, number, number];
/**
 * @class Recursively divided maze, http://en.wikipedia.org/wiki/Maze_generation_algorithm#Recursive_division_method
 * @augments ROT.Map
 */
declare class DividedMaze extends Map {
    _stack: Room$1[];
    _map: number[][];
    create(callback: CreateCallback): this;
    _process(): void;
    _partitionRoom(room: Room$1): void;
}

/**
 * Icey's Maze generator
 * See http://roguebasin.com/index.php/Simple_maze for explanation
 */
declare class IceyMaze extends Map {
    _regularity: number;
    _map: number[][];
    constructor(width: number, height: number, regularity?: number);
    create(callback: CreateCallback): this;
    _randomize(dirs: number[][]): void;
    _isFree(map: number[][], x: number, y: number, width: number, height: number): number | false;
}

declare type Point = [number, number];
interface Options$2 {
    /** Number of cells to create on the horizontal (number of rooms horizontally) */
    cellWidth: number;
    /** Number of cells to create on the vertical (number of rooms vertically) */
    cellHeight: number;
    /** Room min and max width - normally set auto-magically via the constructor. */
    roomWidth: [number, number];
    /** Room min and max height - normally set auto-magically via the constructor. */
    roomHeight: [number, number];
}
interface Room {
    x: number;
    y: number;
    width: number;
    height: number;
    connections: any[];
    cellx: number;
    celly: number;
}
/**
 * Dungeon generator which uses the "original" Rogue dungeon generation algorithm. See https://github.com/Davidslv/rogue-like/blob/master/docs/references/Mark_Damon_Hughes/07_Roguelike_Dungeon_Generation.md
 * @author hyakugei
 */
declare class Rogue extends Map {
    private _options;
    private map;
    private rooms;
    private connectedCells;
    constructor(width: number, height: number, options: Partial<Options$2>);
    create(callback?: CreateCallback): this;
    _calculateRoomSize(size: number, cell: number): [number, number];
    _initRooms(): void;
    _connectRooms(): void;
    _connectUnconnectedRooms(): void;
    _createRandomRoomConnections(): void;
    _createRooms(): void;
    _getWallPosition(aRoom: Room, aDirection: number): Point;
    _drawCorridor(startPosition: Point, endPosition: Point): void;
    _createCorridors(): void;
}

declare const _default$2: {
    Arena: typeof Arena;
    Uniform: typeof Uniform;
    Cellular: typeof Cellular;
    Digger: typeof Digger;
    EllerMaze: typeof EllerMaze;
    DividedMaze: typeof DividedMaze;
    IceyMaze: typeof IceyMaze;
    Rogue: typeof Rogue;
};

/**
 * Base noise generator
 */
declare abstract class Noise {
    abstract get(x: number, y: number): number;
}

/**
 * A simple 2d implementation of simplex noise by Ondrej Zara
 *
 * Based on a speed-improved simplex noise algorithm for 2D, 3D and 4D in Java.
 * Which is based on example code by Stefan Gustavson (stegu@itn.liu.se).
 * With Optimisations by Peter Eastman (peastman@drizzle.stanford.edu).
 * Better rank ordering method by Stefan Gustavson in 2012.
 */
declare class Simplex extends Noise {
    _gradients: number[][];
    _indexes: number[];
    _perms: number[];
    /**
     * @param gradients Random gradients
     */
    constructor(gradients?: number);
    get(xin: number, yin: number): number;
}

declare const _default$1: {
    Simplex: typeof Simplex;
};

declare type ComputeCallback = (x: number, y: number) => any;
declare type PassableCallback = (x: number, y: number) => boolean;
interface Options$1 {
    topology: 4 | 6 | 8;
}
/**
 * @class Abstract pathfinder
 * @param {int} toX Target X coord
 * @param {int} toY Target Y coord
 * @param {function} passableCallback Callback to determine map passability
 * @param {object} [options]
 * @param {int} [options.topology=8]
 */
declare abstract class Path {
    _toX: number;
    _toY: number;
    _passableCallback: PassableCallback;
    _options: Options$1;
    _dirs: number[][];
    constructor(toX: number, toY: number, passableCallback: PassableCallback, options?: Partial<Options$1>);
    /**
     * Compute a path from a given point
     * @param {int} fromX
     * @param {int} fromY
     * @param {function} callback Will be called for every path item with arguments "x" and "y"
     */
    abstract compute(fromX: number, fromY: number, callback: ComputeCallback): void;
    _getNeighbors(cx: number, cy: number): number[][];
}

interface Item$1 {
    x: number;
    y: number;
    prev: Item$1 | null;
}
/**
 * @class Simplified Dijkstra's algorithm: all edges have a value of 1
 * @augments ROT.Path
 * @see ROT.Path
 */
declare class Dijkstra extends Path {
    _computed: {
        [key: string]: Item$1;
    };
    _todo: Item$1[];
    constructor(toX: number, toY: number, passableCallback: PassableCallback, options: Partial<Options$1>);
    /**
     * Compute a path from a given point
     * @see ROT.Path#compute
     */
    compute(fromX: number, fromY: number, callback: ComputeCallback): void;
    /**
     * Compute a non-cached value
     */
    _compute(fromX: number, fromY: number): void;
    _add(x: number, y: number, prev: Item$1 | null): void;
}

interface Item {
    x: number;
    y: number;
    g: number;
    h: number;
    prev: Item | null;
}
/**
 * @class Simplified A* algorithm: all edges have a value of 1
 * @augments ROT.Path
 * @see ROT.Path
 */
declare class AStar extends Path {
    _todo: Item[];
    _done: {
        [key: string]: Item;
    };
    _fromX: number;
    _fromY: number;
    constructor(toX: number, toY: number, passableCallback: PassableCallback, options?: Partial<Options$1>);
    /**
     * Compute a path from a given point
     * @see ROT.Path#compute
     */
    compute(fromX: number, fromY: number, callback: ComputeCallback): void;
    _add(x: number, y: number, prev: Item | null): void;
    _distance(x: number, y: number): number;
}

declare const _default: {
    Dijkstra: typeof Dijkstra;
    AStar: typeof AStar;
};

/**
 * @class Asynchronous main loop
 * @param {ROT.Scheduler} scheduler
 */
declare class Engine {
    _scheduler: Scheduler;
    _lock: number;
    constructor(scheduler: Scheduler);
    /**
     * Start the main loop. When this call returns, the loop is locked.
     */
    start(): this;
    /**
     * Interrupt the engine by an asynchronous action
     */
    lock(): this;
    /**
     * Resume execution (paused by a previous lock)
     */
    unlock(): this;
}

declare type LightColor = [number, number, number];
/** Callback to retrieve cell reflectivity (0..1) */
interface ReflectivityCallback {
    (x: number, y: number): number;
}
/** Will be called for every lit cell */
interface LightingCallback {
    (x: number, y: number, color: LightColor): void;
}
interface Options {
    /** Number of passes. 1 equals to simple FOV of all light sources, >1 means a *highly simplified* radiosity-like algorithm. Default = 1 */
    passes: number;
    /** Cells with emissivity > threshold will be treated as light source in the next pass. Default = 100 */
    emissionThreshold: number;
    /** Max light range, default = 10 */
    range: number;
}
/**
 * Lighting computation, based on a traditional FOV for multiple light sources and multiple passes.
 */
declare class Lighting {
    private _reflectivityCallback;
    private _options;
    private _fov;
    private _lights;
    private _reflectivityCache;
    private _fovCache;
    constructor(reflectivityCallback: ReflectivityCallback, options?: Partial<Options>);
    /**
     * Adjust options at runtime
     */
    setOptions(options: Partial<Options>): this;
    /**
     * Set the used Field-Of-View algo
     */
    setFOV(fov: FOV): this;
    /**
     * Set (or remove) a light source
     */
    setLight(x: number, y: number, color: null | string | LightColor): this;
    /**
     * Remove all light sources
     */
    clearLights(): void;
    /**
     * Reset the pre-computed topology values. Call whenever the underlying map changes its light-passability.
     */
    reset(): this;
    /**
     * Compute the lighting
     */
    compute(lightingCallback: LightingCallback): this;
    /**
     * Compute one iteration from all emitting cells
     * @param emittingCells These emit light
     * @param litCells Add projected light to these
     * @param doneCells These already emitted, forbid them from further calculations
     */
    private _emitLight;
    /**
     * Prepare a list of emitters for next pass
     */
    private _computeEmitters;
    /**
     * Compute one iteration from one cell
     */
    private _emitLightFromCell;
    /**
     * Compute FOV ("form factor") for a potential light source at [x,y]
     */
    private _updateFOV;
}

/** Default with for display and map generators */
declare let DEFAULT_WIDTH: number;
/** Default height for display and map generators */
declare let DEFAULT_HEIGHT: number;
declare const DIRS: {
    4: number[][];
    8: number[][];
    6: number[][];
};
declare const KEYS: {
    /** Cancel key. */
    VK_CANCEL: number;
    /** Help key. */
    VK_HELP: number;
    /** Backspace key. */
    VK_BACK_SPACE: number;
    /** Tab key. */
    VK_TAB: number;
    /** 5 key on Numpad when NumLock is unlocked. Or on Mac, clear key which is positioned at NumLock key. */
    VK_CLEAR: number;
    /** Return/enter key on the main keyboard. */
    VK_RETURN: number;
    /** Reserved, but not used. */
    VK_ENTER: number;
    /** Shift key. */
    VK_SHIFT: number;
    /** Control key. */
    VK_CONTROL: number;
    /** Alt (Option on Mac) key. */
    VK_ALT: number;
    /** Pause key. */
    VK_PAUSE: number;
    /** Caps lock. */
    VK_CAPS_LOCK: number;
    /** Escape key. */
    VK_ESCAPE: number;
    /** Space bar. */
    VK_SPACE: number;
    /** Page Up key. */
    VK_PAGE_UP: number;
    /** Page Down key. */
    VK_PAGE_DOWN: number;
    /** End key. */
    VK_END: number;
    /** Home key. */
    VK_HOME: number;
    /** Left arrow. */
    VK_LEFT: number;
    /** Up arrow. */
    VK_UP: number;
    /** Right arrow. */
    VK_RIGHT: number;
    /** Down arrow. */
    VK_DOWN: number;
    /** Print Screen key. */
    VK_PRINTSCREEN: number;
    /** Ins(ert) key. */
    VK_INSERT: number;
    /** Del(ete) key. */
    VK_DELETE: number;
    /***/
    VK_0: number;
    /***/
    VK_1: number;
    /***/
    VK_2: number;
    /***/
    VK_3: number;
    /***/
    VK_4: number;
    /***/
    VK_5: number;
    /***/
    VK_6: number;
    /***/
    VK_7: number;
    /***/
    VK_8: number;
    /***/
    VK_9: number;
    /** Colon (:) key. Requires Gecko 15.0 */
    VK_COLON: number;
    /** Semicolon (;) key. */
    VK_SEMICOLON: number;
    /** Less-than (<) key. Requires Gecko 15.0 */
    VK_LESS_THAN: number;
    /** Equals (=) key. */
    VK_EQUALS: number;
    /** Greater-than (>) key. Requires Gecko 15.0 */
    VK_GREATER_THAN: number;
    /** Question mark (?) key. Requires Gecko 15.0 */
    VK_QUESTION_MARK: number;
    /** Atmark (@) key. Requires Gecko 15.0 */
    VK_AT: number;
    /***/
    VK_A: number;
    /***/
    VK_B: number;
    /***/
    VK_C: number;
    /***/
    VK_D: number;
    /***/
    VK_E: number;
    /***/
    VK_F: number;
    /***/
    VK_G: number;
    /***/
    VK_H: number;
    /***/
    VK_I: number;
    /***/
    VK_J: number;
    /***/
    VK_K: number;
    /***/
    VK_L: number;
    /***/
    VK_M: number;
    /***/
    VK_N: number;
    /***/
    VK_O: number;
    /***/
    VK_P: number;
    /***/
    VK_Q: number;
    /***/
    VK_R: number;
    /***/
    VK_S: number;
    /***/
    VK_T: number;
    /***/
    VK_U: number;
    /***/
    VK_V: number;
    /***/
    VK_W: number;
    /***/
    VK_X: number;
    /***/
    VK_Y: number;
    /***/
    VK_Z: number;
    /***/
    VK_CONTEXT_MENU: number;
    /** 0 on the numeric keypad. */
    VK_NUMPAD0: number;
    /** 1 on the numeric keypad. */
    VK_NUMPAD1: number;
    /** 2 on the numeric keypad. */
    VK_NUMPAD2: number;
    /** 3 on the numeric keypad. */
    VK_NUMPAD3: number;
    /** 4 on the numeric keypad. */
    VK_NUMPAD4: number;
    /** 5 on the numeric keypad. */
    VK_NUMPAD5: number;
    /** 6 on the numeric keypad. */
    VK_NUMPAD6: number;
    /** 7 on the numeric keypad. */
    VK_NUMPAD7: number;
    /** 8 on the numeric keypad. */
    VK_NUMPAD8: number;
    /** 9 on the numeric keypad. */
    VK_NUMPAD9: number;
    /** * on the numeric keypad. */
    VK_MULTIPLY: number;
    /** + on the numeric keypad. */
    VK_ADD: number;
    /***/
    VK_SEPARATOR: number;
    /** - on the numeric keypad. */
    VK_SUBTRACT: number;
    /** Decimal point on the numeric keypad. */
    VK_DECIMAL: number;
    /** / on the numeric keypad. */
    VK_DIVIDE: number;
    /** F1 key. */
    VK_F1: number;
    /** F2 key. */
    VK_F2: number;
    /** F3 key. */
    VK_F3: number;
    /** F4 key. */
    VK_F4: number;
    /** F5 key. */
    VK_F5: number;
    /** F6 key. */
    VK_F6: number;
    /** F7 key. */
    VK_F7: number;
    /** F8 key. */
    VK_F8: number;
    /** F9 key. */
    VK_F9: number;
    /** F10 key. */
    VK_F10: number;
    /** F11 key. */
    VK_F11: number;
    /** F12 key. */
    VK_F12: number;
    /** F13 key. */
    VK_F13: number;
    /** F14 key. */
    VK_F14: number;
    /** F15 key. */
    VK_F15: number;
    /** F16 key. */
    VK_F16: number;
    /** F17 key. */
    VK_F17: number;
    /** F18 key. */
    VK_F18: number;
    /** F19 key. */
    VK_F19: number;
    /** F20 key. */
    VK_F20: number;
    /** F21 key. */
    VK_F21: number;
    /** F22 key. */
    VK_F22: number;
    /** F23 key. */
    VK_F23: number;
    /** F24 key. */
    VK_F24: number;
    /** Num Lock key. */
    VK_NUM_LOCK: number;
    /** Scroll Lock key. */
    VK_SCROLL_LOCK: number;
    /** Circumflex (^) key. Requires Gecko 15.0 */
    VK_CIRCUMFLEX: number;
    /** Exclamation (!) key. Requires Gecko 15.0 */
    VK_EXCLAMATION: number;
    /** Double quote () key. Requires Gecko 15.0 */
    VK_DOUBLE_QUOTE: number;
    /** Hash (#) key. Requires Gecko 15.0 */
    VK_HASH: number;
    /** Dollar sign ($) key. Requires Gecko 15.0 */
    VK_DOLLAR: number;
    /** Percent (%) key. Requires Gecko 15.0 */
    VK_PERCENT: number;
    /** Ampersand (&) key. Requires Gecko 15.0 */
    VK_AMPERSAND: number;
    /** Underscore (_) key. Requires Gecko 15.0 */
    VK_UNDERSCORE: number;
    /** Open parenthesis (() key. Requires Gecko 15.0 */
    VK_OPEN_PAREN: number;
    /** Close parenthesis ()) key. Requires Gecko 15.0 */
    VK_CLOSE_PAREN: number;
    VK_ASTERISK: number;
    /** Plus (+) key. Requires Gecko 15.0 */
    VK_PLUS: number;
    /** Pipe (|) key. Requires Gecko 15.0 */
    VK_PIPE: number;
    /** Hyphen-US/docs/Minus (-) key. Requires Gecko 15.0 */
    VK_HYPHEN_MINUS: number;
    /** Open curly bracket ({) key. Requires Gecko 15.0 */
    VK_OPEN_CURLY_BRACKET: number;
    /** Close curly bracket (}) key. Requires Gecko 15.0 */
    VK_CLOSE_CURLY_BRACKET: number;
    /** Tilde (~) key. Requires Gecko 15.0 */
    VK_TILDE: number;
    /** Comma (,) key. */
    VK_COMMA: number;
    /** Period (.) key. */
    VK_PERIOD: number;
    /** Slash (/) key. */
    VK_SLASH: number;
    /** Back tick (`) key. */
    VK_BACK_QUOTE: number;
    /** Open square bracket ([) key. */
    VK_OPEN_BRACKET: number;
    /** Back slash (\) key. */
    VK_BACK_SLASH: number;
    /** Close square bracket (]) key. */
    VK_CLOSE_BRACKET: number;
    /** Quote (''') key. */
    VK_QUOTE: number;
    /** Meta key on Linux, Command key on Mac. */
    VK_META: number;
    /** AltGr key on Linux. Requires Gecko 15.0 */
    VK_ALTGR: number;
    /** Windows logo key on Windows. Or Super or Hyper key on Linux. Requires Gecko 15.0 */
    VK_WIN: number;
    /** Linux support for this keycode was added in Gecko 4.0. */
    VK_KANA: number;
    /** Linux support for this keycode was added in Gecko 4.0. */
    VK_HANGUL: number;
    /** 英数 key on Japanese Mac keyboard. Requires Gecko 15.0 */
    VK_EISU: number;
    /** Linux support for this keycode was added in Gecko 4.0. */
    VK_JUNJA: number;
    /** Linux support for this keycode was added in Gecko 4.0. */
    VK_FINAL: number;
    /** Linux support for this keycode was added in Gecko 4.0. */
    VK_HANJA: number;
    /** Linux support for this keycode was added in Gecko 4.0. */
    VK_KANJI: number;
    /** Linux support for this keycode was added in Gecko 4.0. */
    VK_CONVERT: number;
    /** Linux support for this keycode was added in Gecko 4.0. */
    VK_NONCONVERT: number;
    /** Linux support for this keycode was added in Gecko 4.0. */
    VK_ACCEPT: number;
    /** Linux support for this keycode was added in Gecko 4.0. */
    VK_MODECHANGE: number;
    /** Linux support for this keycode was added in Gecko 4.0. */
    VK_SELECT: number;
    /** Linux support for this keycode was added in Gecko 4.0. */
    VK_PRINT: number;
    /** Linux support for this keycode was added in Gecko 4.0. */
    VK_EXECUTE: number;
    /** Linux support for this keycode was added in Gecko 4.0.	 */
    VK_SLEEP: number;
};

/**
 * Always positive modulus
 * @param x Operand
 * @param n Modulus
 * @returns x modulo n
 */
declare function mod(x: number, n: number): number;
declare function clamp(val: number, min?: number, max?: number): number;
declare function capitalize(string: string): string;
/**
 * Format a string in a flexible way. Scans for %s strings and replaces them with arguments. List of patterns is modifiable via String.format.map.
 * @param {string} template
 * @param {any} [argv]
 */
declare function format(template: string, ...args: any[]): string;

declare const util_capitalize: typeof capitalize;
declare const util_clamp: typeof clamp;
declare const util_format: typeof format;
declare const util_mod: typeof mod;
declare namespace util {
  export {
    util_capitalize as capitalize,
    util_clamp as clamp,
    util_format as format,
    util_mod as mod,
  };
}

declare type Color$1 = [number, number, number];
declare function fromString(str: string): Color$1;
/**
 * Add two or more colors
 */
declare function add(color1: Color$1, ...colors: Color$1[]): Color$1;
/**
 * Add two or more colors, MODIFIES FIRST ARGUMENT
 */
declare function add_(color1: Color$1, ...colors: Color$1[]): Color$1;
/**
 * Multiply (mix) two or more colors
 */
declare function multiply(color1: Color$1, ...colors: Color$1[]): Color$1;
/**
 * Multiply (mix) two or more colors, MODIFIES FIRST ARGUMENT
 */
declare function multiply_(color1: Color$1, ...colors: Color$1[]): Color$1;
/**
 * Interpolate (blend) two colors with a given factor
 */
declare function interpolate(color1: Color$1, color2: Color$1, factor?: number): Color$1;
declare const lerp: typeof interpolate;
/**
 * Interpolate (blend) two colors with a given factor in HSL mode
 */
declare function interpolateHSL(color1: Color$1, color2: Color$1, factor?: number): Color$1;
declare const lerpHSL: typeof interpolateHSL;
/**
 * Create a new random color based on this one
 * @param color
 * @param diff Set of standard deviations
 */
declare function randomize(color: Color$1, diff: number | Color$1): Color$1;
/**
 * Converts an RGB color value to HSL. Expects 0..255 inputs, produces 0..1 outputs.
 */
declare function rgb2hsl(color: Color$1): Color$1;
/**
 * Converts an HSL color value to RGB. Expects 0..1 inputs, produces 0..255 outputs.
 */
declare function hsl2rgb(color: Color$1): Color$1;
declare function toRGB(color: Color$1): string;
declare function toHex(color: Color$1): string;

declare const color_add: typeof add;
declare const color_add_: typeof add_;
declare const color_fromString: typeof fromString;
declare const color_hsl2rgb: typeof hsl2rgb;
declare const color_interpolate: typeof interpolate;
declare const color_interpolateHSL: typeof interpolateHSL;
declare const color_lerp: typeof lerp;
declare const color_lerpHSL: typeof lerpHSL;
declare const color_multiply: typeof multiply;
declare const color_multiply_: typeof multiply_;
declare const color_randomize: typeof randomize;
declare const color_rgb2hsl: typeof rgb2hsl;
declare const color_toHex: typeof toHex;
declare const color_toRGB: typeof toRGB;
declare namespace color {
  export { color_add as add, color_add_ as add_, color_fromString as fromString, color_hsl2rgb as hsl2rgb, color_interpolate as interpolate, color_interpolateHSL as interpolateHSL, color_lerp as lerp, color_lerpHSL as lerpHSL, color_multiply as multiply, color_multiply_ as multiply_, color_randomize as randomize, color_rgb2hsl as rgb2hsl, color_toHex as toHex, color_toRGB as toRGB };
  export type { Color$1 as Color };
}

/**
 * @namespace
 * Contains text tokenization and breaking routines
 */
declare const TYPE_TEXT = 0;
declare const TYPE_NEWLINE = 1;
declare const TYPE_FG = 2;
declare const TYPE_BG = 3;
/**
 * Measure size of a resulting text block
 */
declare function measure(str: string, maxWidth: number): {
    width: number;
    height: number;
};
/**
 * Convert string to a series of a formatting commands
 */
declare function tokenize(str: string, maxWidth: number): any[];

declare const text_TYPE_BG: typeof TYPE_BG;
declare const text_TYPE_FG: typeof TYPE_FG;
declare const text_TYPE_NEWLINE: typeof TYPE_NEWLINE;
declare const text_TYPE_TEXT: typeof TYPE_TEXT;
declare const text_measure: typeof measure;
declare const text_tokenize: typeof tokenize;
declare namespace text {
  export {
    text_TYPE_BG as TYPE_BG,
    text_TYPE_FG as TYPE_FG,
    text_TYPE_NEWLINE as TYPE_NEWLINE,
    text_TYPE_TEXT as TYPE_TEXT,
    text_measure as measure,
    text_tokenize as tokenize,
  };
}

declare const Util: typeof util;

declare const Color: typeof color;

declare const Text: typeof text;

export { Color, DEFAULT_HEIGHT, DEFAULT_WIDTH, DIRS, Display, Engine, EventQueue, _default$3 as FOV, KEYS, Lighting, _default$2 as Map, _default$1 as Noise, _default as Path, _default$5 as RNG, _default$4 as Scheduler, StringGenerator, Text, Util };
export type { SpeedActor };
