//===BEGIN===
class ShareClipPreferences {
  static qualityOptions = [
    {value: 'low', label: '通信量優先'},
    {value: 'source', label: '再生中の画質'},
    ...[144, 240, 360, 480, 720, 1080].map(height => ({value: String(height), label: height + 'p'}))
  ];

  static qualityFields = [
    {kind: 'preview', id: 'shareClip.previewQuality', defaultValue: 'source', label: 'プレビューの画質',
      description: '編集画面で区間を確認するときの画質です。「再生中の画質」は視聴中の映像に合わせ、「通信量優先」は利用できる低画質の配信を使います。'},
    {kind: 'scene', id: 'shareClip.sceneQuality', defaultValue: 'low', label: '場面画像の画質',
      description: '区間を選ぶとき、動画から読み込む場面画像の画質です。「通信量優先」を選ぶと画像の読み込みに使うデータ量を抑えられます。'},
    {kind: 'export', id: 'shareClip.exportQuality', defaultValue: 'source', label: '保存する動画の画質',
      description: '保存やXへの添付に使うクリップの画質です。指定した高さを上限として、ニコニコが配信する画質から選びます。720pの映像を1080pに引き伸ばすことはありません。手元のファイルを選んだ場合は、そのファイルが元の映像になります。'}
  ];

  static fields = [
    ...this.qualityFields.map(field => ({...field, type: 'select', presentation: 'dropdown', options: this.qualityOptions})),
    {id: 'shareClip.initialDurationSeconds', defaultValue: 30, label: '最初に選択する区間の長さ',
      type: 'slider', min: 1, max: 600, step: 1, unit: '秒',
      description: '新しくクリップを編集するときに選択する秒数です。動画の残りが短い場合は末尾まで選択します。開始と終了は編集画面で調整できます。'},
    {id: 'shareClip.includeComments', defaultValue: false, label: '最初からコメントを含める',
      type: 'boolean', description: '新しいクリップの「コメント」をオンにします。表示中のコメントを映像に重ねて書き出すか、クリップごとに変更できます。'},
    {id: 'shareClip.includeEffects', defaultValue: false, label: '最初から画面エフェクトを含める',
      type: 'boolean', description: '新しいクリップの「画面エフェクト」をオンにします。プレイヤーで設定した効果を映像に重ねて書き出すか、クリップごとに変更できます。'},
    {id: 'shareClip.openXDraft', defaultValue: true, label: 'クリップ完成後にXの下書きを開く',
      type: 'boolean', description: 'MP4が完成したら別タブでXを開き、作成した動画を下書きに添付します。元のタブを表示中でクリップボードへの書き込みが許可済みなら、動画をクリップボードにもコピーします。投稿はXで確認してから行います。クリップ編集画面でも変更できます。'}
  ];

  static defaults = Object.fromEntries(this.fields.map(field => [field.id, field.defaultValue]));

  static accepts(id, value) {
    const field = this.fields.find(item => item.id === id);
    if (!field) return false;
    if (field.type === 'select') return field.options.some(option => option.value === value);
    if (field.type === 'slider') return Number.isInteger(value) && value >= field.min && value <= field.max;
    return typeof value === 'boolean';
  }

  static get(config, id) {
    const value = config?.getValue?.(id);
    return this.accepts(id, value) ? value : this.defaults[id];
  }
}
//===END===
export {ShareClipPreferences};
