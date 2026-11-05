import {SceneSearchPreviewView} from '../nico-src/SceneSearchPreviewView';
import {SceneSearchDomLease} from '../../../packages/zenza/src/sceneSearch/SceneSearchDomLease';

type IsAny<T> = 0 extends (1 & T) ? true : false;
type AssertTyped<T extends false> = T;
type PreviewOptions = ConstructorParameters<typeof SceneSearchPreviewView>[0];
type NativeImageIsTyped = AssertTyped<IsAny<PreviewOptions['image']>>;
type NativeMiniIsTyped = AssertTyped<IsAny<PreviewOptions['mini']>>;
type NativeListIsTyped = AssertTyped<IsAny<PreviewOptions['listView']>>;

const node = document.createElement('div');
const lease = new SceneSearchDomLease(node, {
  position: true, styles: SceneSearchDomLease.typography, classes: ['scene-borrowed'], hidden: true
});
lease.moveTo(document.createDocumentFragment());
lease.restore();
const view = new SceneSearchPreviewView({
  document, host: node, image: node, mini: document.createElement('aside'),
  listView: {element: document.createElement('aside'), dispose() {}},
  onAction(action, context, event) {
    const actionName: string = action;
    const nativeEvent: Event = event;
    void actionName; void nativeEvent; void context;
  }
});
view.setImage(null);
view.setListView(null);
view.fit({imageScale: 1, listWidth: 280, listMaxHeight: 240});
view.dispose();

// @ts-expect-error a Document is not an owned native HTMLElement
new SceneSearchDomLease(document, {position: true});
// @ts-expect-error lease flags must remain booleans
new SceneSearchDomLease(node, {position: 'yes'});
// @ts-expect-error movement takes a real DOM parent
lease.moveTo('body');
// @ts-expect-error native preview nodes cannot be arbitrary objects
new SceneSearchPreviewView({document, host: node, image: {}});
// @ts-expect-error list ownership requires an explicit disposer
new SceneSearchPreviewView({document, host: node, listView: {element: node}});
// @ts-expect-error list handles must own a native HTMLElement
view.setListView({element: document, dispose() {}});
// @ts-expect-error image dimensions are numeric boundary values
view.fit({imageScale: '100%', listWidth: 280, listMaxHeight: 240});
