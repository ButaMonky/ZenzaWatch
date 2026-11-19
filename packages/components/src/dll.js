// Shared renderer for the player, its settings, and playlist directives.
import * as lit from 'lit/html.js';
import {repeat} from 'lit/directives/repeat.js';
import {classMap} from 'lit/directives/class-map.js';

const dll = { directives: {}};
//===BEGIN===
dll.lit = lit;
dll.directives.repeat = repeat;
dll.directives.classMap = classMap;
//===END===
export {dll};