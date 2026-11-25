export interface FeedControls {
  admin: boolean;
  // The value of each switch whose request has no answer yet: the switch draws it at the press.
  asked: ReadonlyMap<string, boolean>;
  onSet: (id: string, enabled: boolean, acceptUnofficial: boolean) => void;
}
