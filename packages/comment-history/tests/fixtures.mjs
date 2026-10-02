export const KEY = 'SYNTHETIC_TEST_SECRET_NOT_A_REAL_KEY';
export function watch(videoId='sm1') { return {meta:{status:200},data:{response:{$watchV4:{data:{
 video:{id:videoId},comment:{nvComment:{server:'https://public.nvcomment.nicovideo.jp',threadKey:KEY,params:{language:'ja-jp',targets:[{id:'10',fork:'owner'},{id:'10',fork:'main'}]}},
 threads:[{id:10,fork:1,forkLabel:'owner',videoId},{id:10,fork:0,forkLabel:'main',videoId}],layers:[]}
}}}}}; }
export function comment(no, sec=1700000000, extra={}) { return {id:`synthetic-id-${no}`,no,vposMs:no*10,body:'SYNTHETIC_BODY',commands:[],userId:'SYNTHETIC_USER',isPremium:false,score:0,postedAt:new Date(sec*1000).toISOString(),nicoruCount:0,nicoruId:null,source:'',isMyPost:false,...extra}; }
export function body(comments=[],fork='main',id='10') { return {meta:{status:200},data:{threads:[{id,fork,commentCount:comments.length,comments}]}}; }
export function response(data,status=200,headers={}) {return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json',...headers}});}
