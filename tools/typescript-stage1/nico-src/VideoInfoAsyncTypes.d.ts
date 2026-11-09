/** Type-only asynchronous ownership identifiers for VideoInfoPanel (Task189).
 * Description loading and ZenTube timer callbacks have distinct generations.
 */
declare const zenzaDescriptionGenerationBrand: unique symbol;
declare const zenzaZenTubeTimerGenerationBrand: unique symbol;
export type ZenzaDescriptionGeneration = number & {
  readonly [zenzaDescriptionGenerationBrand]: 'description';
};
export type ZenzaZenTubeTimerGeneration = number & {
  readonly [zenzaZenTubeTimerGenerationBrand]: 'zen-tube-timer';
};
export type ZenzaVideoInfoAsyncOwner = Readonly<{
  descriptionGeneration: ZenzaDescriptionGeneration;
  videoInfo: unknown;
}>;
