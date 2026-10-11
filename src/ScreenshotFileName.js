// Task318: safe, configurable screenshots with backward-compatible empty-template mode.
// User templates are data only. Neither evaluation nor filesystem paths are supported.
//===BEGIN===
class ScreenshotFileName {
  static get DEFAULT_TEMPLATE() { return '{title} - {watchId}@{time}{suffix}'; }
  static get TOKENS() {
    return ['title','watchId','videoId','uploader','time','date','datetime','suffix'];
  }
  static get PRESETS() {
    return [
      {name:'従来どおり（標準）',value:''},
      {name:'動画IDと再生位置',value:'{watchId}_{time}{suffix}'},
      {name:'日付・動画タイトル',value:'{date}_{title}_{watchId}@{time}{suffix}'},
      {name:'タイトル・再生位置',value:'{title}_{time}{suffix}'},
      {name:'投稿者・動画ID',value:'{uploader}_{watchId}@{time}{suffix}'}
    ];
  }
  static validateTemplate(value) {
    if(typeof value!=='string'||value.length>200){return false;}
    if(value===''){return true;}
    const tokens=value.match(/\{[^{}]*\}/g)||[];
    if(tokens.some(token=>!this.TOKENS.includes(token.slice(1,-1)))){return false;}
    const plain=value.replace(/\{[^{}]*\}/g,'');
    return !/[{}<>:"/\\|?*\x00-\x1f]/.test(plain) &&
      !/\.\./.test(plain) && !!value.trim();
  }
  static _safe(value) {
    return String(value??'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')
      .replace(/[. ]+$/g,'').trim();
  }
  static format({prefix='',template='',title='',watchId='',videoId='',
    uploader='',currentTime=0,suffix='',now=new Date(),formatTime}={}) {
    const date=now && typeof now.getTime==='function' &&
      !Number.isNaN(now.getTime())?new Date(now.getTime()):new Date();
    const pad=n=>String(n).padStart(2,'0');
    const day=[date.getFullYear(),pad(date.getMonth()+1),pad(date.getDate())].join('-');
    const dateTime=day+'_'+[pad(date.getHours()),pad(date.getMinutes()),
      pad(date.getSeconds())].join('-');
    const time=typeof formatTime==='function'?
      String(formatTime(currentTime)||'0_00').replace(/:/g,'_'):
      String(Math.floor(Math.max(0,Number(currentTime)||0)));
    const values={title:this._safe(title),watchId:this._safe(watchId),
      videoId:this._safe(videoId||watchId),uploader:this._safe(uploader)||'投稿者不明',
      time:this._safe(time),date:day,datetime:dateTime,suffix:this._safe(suffix)};
    const resolvedTemplate=this.validateTemplate(template)&&template?
      template:this.DEFAULT_TEMPLATE;
    const expand=input=>String(input).replace(/\{([^{}]+)\}/g,(match,key)=>
      this.TOKENS.includes(key)?values[key]:match);
    let base=expand(resolvedTemplate);
    // The extension is always appended once; don't allow a typed .png to
    // duplicate it or put a comments suffix after the file extension.
    base=base.replace(/\.png$/i,'');
    if(suffix && !resolvedTemplate.includes('{suffix}')){base+=values.suffix;}
    const expandedPrefix=expand(prefix);
    const raw=this._safe(expandedPrefix+base)||this._safe(values.watchId+'@'+values.time);
    const bounded=raw.slice(0,176).replace(/[. ]+$/g,'')||'screenshot';
    const safeName=/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(bounded)?
      '_'+bounded:bounded;
    return safeName+'.png';
  }
}
//===END===
export {ScreenshotFileName};
