// Task577: static comment layout dimensions and capacity are numeric.
import {CommentLayer,type CommentLayoutScreen} from '../comment-src/CommentLayer';

const screen:CommentLayoutScreen=CommentLayer.SCREEN;
const width:number=screen.WIDTH_INNER;
const full:number=screen.WIDTH_FULL;
const height:number=screen.HEIGHT;
const maximum:number=CommentLayer.MAX_COMMENT;
void width;void full;void height;void maximum;

// @ts-expect-error A numerical screen coordinate cannot hold text.
const invalidWidth:CommentLayoutScreen={...screen,WIDTH_INNER:'512'};
// @ts-expect-error Capacity is a numeric limit.
const invalidCapacity:string=CommentLayer.MAX_COMMENT;
void invalidWidth;void invalidCapacity;
