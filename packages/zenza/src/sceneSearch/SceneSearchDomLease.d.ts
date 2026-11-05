export interface SceneSearchDomLeaseOptions {
  /** Opt in to exclusive position ownership. Style-only leases do not move the node. */
  position?: boolean;
  styles?: readonly string[];
  classes?: readonly string[];
  /** Attribute names other than class/style, which must be leased by individual member. */
  attributes?: readonly string[];
  hidden?: boolean;
}

export declare class SceneSearchDomLease {
  static readonly typography: readonly string[];
  static preserveTypography(node: HTMLElement): void;
  constructor(node: HTMLElement, options?: SceneSearchDomLeaseOptions);
  readonly node: HTMLElement;
  readonly released: boolean;
  moveTo(parent: Node, before?: Node | null): void;
  /** Successful restores are idempotent; failed aspects remain available for retry. */
  restore(): void;
}
