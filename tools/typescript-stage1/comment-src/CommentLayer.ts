// Task577: strictly typed geometry schema for legacy comment rendering.
export interface CommentLayoutScreen {
  WIDTH_INNER: number;
  WIDTH_FULL_INNER: number;
  WIDTH_FULL_INNER_HTML5: number;
  WIDTH: number;
  WIDTH_FULL: number;
  OUTER_WIDTH_FULL: number;
  HEIGHT: number;
}
//===BEGIN===

class CommentLayer {
  declare static SCREEN: CommentLayoutScreen;
  declare static MAX_COMMENT: number;
}
// この数字はレイアウト計算上の仮想領域の物であり、実際に表示するサイズはview依存
CommentLayer.SCREEN = {
  WIDTH_INNER: 512,
  WIDTH_FULL_INNER: 640,
  WIDTH_FULL_INNER_HTML5: 684,
  WIDTH: 512 + 32,
  WIDTH_FULL: 640 + 32,
  OUTER_WIDTH_FULL: (640 + 32) * 1.1,
  HEIGHT: 384
};
CommentLayer.MAX_COMMENT = 10000;

//===END===

export {CommentLayer};
