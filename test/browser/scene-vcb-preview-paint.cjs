'use strict';
// Independent compositor screenshot proof: does a known test-only thumbnail
// color reach actual Chromium pixels, not only DOM/CSS geometry?
async function capturePaintedCanvas(cdp,visual){
 const box=visual.canvas,view=visual.viewport;
 if(!box||box.width<8||box.height<8||
  box.right<=0||box.bottom<=0||box.left>=view.right||box.top>=view.bottom){
  return {measured:false,reason:'canvas-outside-viewport',box};
 }
 const xs=[.15,.5,.85],ys=[.15,.5,.85];
 const points=[];
 for(const fy of ys)for(const fx of xs){
  const x=Math.floor(box.left+box.width*fx);
  const y=Math.floor(box.top+box.height*fy);
  if(x>=1&&x<view.right-1&&y>=1&&y<view.bottom-1)
   points.push({x,y});
 }
 if(!points.length)return {measured:false,reason:'no-sample-pixels',box};
 const shot=await cdp.send('Page.captureScreenshot',{
  format:'png',captureBeyondViewport:false,fromSurface:true});
 const prefix='data:image/png;base64,';
 const expr='(async()=>{const image=new Image();'+
  'image.src='+JSON.stringify(prefix+shot.data)+';await image.decode();'+
  'const canvas=document.createElement("canvas");'+
  'canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;'+
  'const ctx=canvas.getContext("2d");ctx.drawImage(image,0,0);'+
  'return '+JSON.stringify(points)+'.map(p=>{const a=ctx.getImageData(p.x,p.y,1,1).data;'+
  'return {x:p.x,y:p.y,r:a[0],g:a[1],b:a[2],alpha:a[3]}})})()';
 const data=await cdp.evaluate(expr,{awaitPromise:true});
 const green=data.filter(p=>p.g>p.r+58&&p.g>p.b+35&&p.g>=100);
 return {measured:true,greenSamples:green.length,samples:data.length,
  pixels:data,canvas:box,hasPaintedThumbnail:green.length>0};
}
module.exports={capturePaintedCanvas};
