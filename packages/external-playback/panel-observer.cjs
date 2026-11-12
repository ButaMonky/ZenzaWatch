'use strict';
function frameTopologyChanged(records){
  return records.some(record=>[...record.addedNodes,...record.removedNodes].some(node=>
    node.nodeType===1&&(node.localName==='iframe'||!!node.querySelector('iframe'))));
}
module.exports={frameTopologyChanged};
