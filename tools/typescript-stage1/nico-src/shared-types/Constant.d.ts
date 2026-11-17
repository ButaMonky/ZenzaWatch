// Task1061: src/constant.js の CONSTANT の型。キーの増減は test/shared-types.test.mjs が src/constant.js と突き合わせる。
export interface ZenzaConstant {
  BASE_Z_INDEX: number;
  CONTROL_BAR_HEIGHT: number;
  SIDE_PLAYER_WIDTH: number;
  SIDE_PLAYER_HEIGHT: number;
  BIG_PLAYER_WIDTH: number;
  BIG_PLAYER_HEIGHT: number;
  RIGHT_PANEL_WIDTH: number;
  BOTTOM_PANEL_HEIGHT: number;
  BLANK_VIDEO_URL: string;
  BLANK_PNG: string;
  MEDIA_ERROR: {MEDIA_ERR_ABORTED: 1; MEDIA_ERR_NETWORK: 2; MEDIA_ERR_DECODE: 3; MEDIA_ERR_SRC_NOT_SUPPORTED: 4};
  /** CSS 変数の宣言（:root に入れる文字列） */
  BASE_CSS_VARS: string;
  COMMON_CSS: string;
  SCROLLBAR_CSS: string;
}
