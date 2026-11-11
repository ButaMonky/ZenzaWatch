import type {ZenzaDescriptionGeneration, ZenzaZenTubeTimerGeneration, ZenzaVideoInfoAsyncOwner} from '../nico-src/VideoInfoAsyncTypes';
import type {ZenzaDescriptionSeries as ValidSeries} from '../nico-src/VideoInfoAsyncTypes';
// @ts-expect-error validated production series cannot contain an object as its title
const badSeries: ValidSeries = {title: {}, video: {prev:null,next:null}};
// @ts-expect-error external series IDs must be validated as strings before rendering
const badSeriesVideo: ValidSeries = {title: 'series', video: {prev:{id:42},next:null}};
/** Compile-time negative examples for video info panel callbacks (Task189). */
declare let description: ZenzaDescriptionGeneration;
declare let autoTimer: ZenzaZenTubeTimerGeneration;
declare const active: ZenzaVideoInfoAsyncOwner;
// @ts-expect-error a timer generation cannot be used as a description generation
description = autoTimer;
// @ts-expect-error a description generation cannot be used as a timer generation
autoTimer = description;
// @ts-expect-error the generation cannot be an arbitrary number
description = 1;
// @ts-expect-error an async owner snapshot cannot change after it is captured
active.descriptionGeneration = description;
// @ts-expect-error the owning video identity is required
const missingVideo: ZenzaVideoInfoAsyncOwner = {descriptionGeneration: description};
