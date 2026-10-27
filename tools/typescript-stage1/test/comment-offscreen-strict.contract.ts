import {OffscreenLayer} from '../comment-src/OffscreenLayer';
import type {
  OffscreenLayerContract,
  OffscreenLayerHandleContract,
  OffscreenTextFieldContract,
  OffscreenConfigPropsContract,
  OffscreenConfigContract
} from '../comment-src/OffscreenLayer';

const props: OffscreenConfigPropsContract={
  baseFontFamily:'Arial',baseFontBolder:true,
  cssFontWeight:'bold',baseChatScale:1
};
const config: OffscreenConfigContract={
  props,
  onkey: (key,listener)=>{void key;void listener;}
};
const layer: OffscreenLayerContract=OffscreenLayer(config);
const handle: Promise<OffscreenLayerHandleContract>=layer.get();
void handle;
declare const field: OffscreenTextFieldContract;
const measured: {width:number;height:number}=
  field.measureChat({},'Hello',32,'naka','medium','','html5');
void measured;
// @ts-expect-error CSS font weight setting remains a string, not a number.
const invalidProps: OffscreenConfigPropsContract={...props,cssFontWeight:400};
// @ts-expect-error Text measurement pixels must be numeric.
field.measureChat({},'test','32','naka','medium','','html5');
void invalidProps;
