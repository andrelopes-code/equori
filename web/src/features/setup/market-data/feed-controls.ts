export interface FeedControls {
  admin: boolean;
  // The feed whose switch has a request in flight.
  loadingId: string | null;
  onSet: (id: string, enabled: boolean, acceptUnofficial: boolean) => void;
}
