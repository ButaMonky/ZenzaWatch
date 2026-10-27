import {NicoScriptParser,NicoScripter} from '../comment-src/NicoScripter';
import type {
  NicoScriptParserContract,NicoScriptParsedCommand,
  NicoScripterSourceChat,NicoScripterTargetChat,NicoScripterContract
} from '../comment-src/NicoScripter';
const parser: NicoScriptParserContract=NicoScriptParser;
const commands: NicoScriptParsedCommand[]=parser.parseNiwango(['/seek(5)']);
const lines:string[]=parser.splitLines('a;b');
const tokens:string[]=parser.parseNicosParams('@逆 投コメ');
const script:NicoScripterContract=new NicoScripter();
const chat:NicoScripterSourceChat={text:'@逆',vpos:1,no:2,uniqNo:3,
  beginTime:0,duration:4,hasDurationSet:true,color:'#fff',size:'medium',type:'naka'};
const target:NicoScripterTargetChat={beginTime:0,text:'text',isNicoScript:false,
  fork:0,hasColorCommand:false,hasSizeCommand:false,hasTypeCommand:false,
  color:'#fff',size:'medium',type:'naka',isReverse:false};
script.add(chat);void target;void commands;void lines;void tokens;
// @ts-expect-error The script parser accepts textual nico script.
parser.parseNicos(42);
// @ts-expect-error A source chat must have numeric video position.
const bad:NicoScripterSourceChat={...chat,vpos:'5'};
void bad;
