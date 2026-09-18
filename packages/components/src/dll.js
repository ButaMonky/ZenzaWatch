import * as lit from 'https://esm.run/lit';
import {repeat} from 'https://esm.run/lit/directives/repeat';
import {classMap} from 'https://esm.run/lit/directives/class-map';

const dll = { directives: {}};
//===BEGIN===
dll.lit = lit;
dll.directives.repeat = repeat;
dll.directives.classMap = classMap;
//===END===
export {dll};