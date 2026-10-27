// Task553: public screenshot filename contract and negative TypeScript assertions.
import {ScreenshotFileName,type ScreenshotFilenameOptions}
  from '../advanced-src/ScreenshotFileName';

const spec:ScreenshotFilenameOptions={
  title:'Sample',watchId:'sm9',currentTime:83,
  formatTime:seconds=>String(seconds),
  now:new Date('2026-10-15T00:00:00')
};
const imageName:string=ScreenshotFileName.format(spec);
const validated:boolean=ScreenshotFileName.validateTemplate('{title}_{watchId}');
const presetName:string=ScreenshotFileName.PRESETS[0].name;
void imageName;void validated;void presetName;

// @ts-expect-error Current time is a numeric duration, not a text timestamp.
ScreenshotFileName.format({currentTime:'83'});
// @ts-expect-error Date metadata must be a Date instance.
ScreenshotFileName.format({now:'2026-10-15'});
// @ts-expect-error The formatter callback must return a text value.
ScreenshotFileName.format({formatTime:sec=>sec});
// @ts-expect-error The returned filename is a string, not a number.
const invalidFilename:number=ScreenshotFileName.format(spec);
void invalidFilename;
