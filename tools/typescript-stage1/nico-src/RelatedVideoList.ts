/**
 * Canonical TypeScript source for packages/zenza/src/Playlist/RelatedVideoList.js (Task851).
 */
/**
 * Raw DOM / API values whose shape this module does not own; one documented loose alias.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
export interface RecommendItem {
  id: string;
  contentType?: string;
  content?: {title?: string; duration?: number; registeredAt?: string;
    count?: {comment?: number; mylist?: number; view?: number}; thumbnail?: {url?: string}};
}
/** The parts of VideoList / VideoListItem / RecommendAPILoader used here. */
declare class VideoList {
  view?: Loose;
  model: {setItem(items: unknown[]): unknown};
  _initializeView(): void;
}
declare const VideoListItem: {
  new (data: Record<string, unknown>): unknown;
  createByVideoInfoModel(info: unknown): {serialize(): Record<string, unknown>};
};
declare const RecommendAPILoader: {load(params: {videoId: string}): Promise<{items?: RecommendItem[]}>};


class RelatedVideoList extends VideoList {
  declare _watchId: string;
  declare _requestGeneration?: number;
  update(listData: Record<string, unknown>[], watchId: string) {
    if (!this.view) {
      this._initializeView();
    }
    this._watchId = watchId;
    const items = listData
      .filter(itemData => itemData.id).map(itemData => new VideoListItem(itemData));
    // A related-video list belongs to exactly one video, not the playlist.
    // A zero-item response must clear the previous video's rows and maps.
    this.model.setItem(items);
    this.view.scrollTop(0);
  }
  async fetchRecommend(videoId: string, watchId: string | null = null, videoInfo: unknown = null) {
    const requestId = this._requestGeneration = (this._requestGeneration || 0) + 1;
    const relatedVideo: Record<string, unknown>[] = [];
    watchId = watchId || videoId;
    videoInfo && relatedVideo.push(VideoListItem.createByVideoInfoModel(videoInfo).serialize());
    // Clear A as soon as B starts; optionally show B itself while loading.
    this.update(relatedVideo, watchId as string);
    const data = await RecommendAPILoader.load({videoId}).catch(() => ({} as {items?: RecommendItem[]}));
    // A network completion must not overwrite the later B request.
    if (requestId !== this._requestGeneration) {
      return;
    }
    const items = data.items || [];
    for (const item of items) {
      if (item.contentType && item.contentType !== 'video') {
        continue;
      }
      const content = item.content;
      if (!content) {
        continue;
      }
      relatedVideo.push({
        _format: 'recommendApi',
        _data: item,
        id: item.id,
        title: content.title,
        length_seconds: content.duration,
        num_res: content.count?.comment,
        mylist_counter: content.count?.mylist,
        view_counter: content.count?.view,
        thumbnail_url: content.thumbnail?.url,
        first_retrieve: content.registeredAt,
        has_data: true,
        is_translated: false
      });
    }
    this.update(relatedVideo, watchId as string);
  }
}

export {RelatedVideoList};
