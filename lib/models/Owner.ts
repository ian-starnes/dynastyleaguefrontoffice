/** A Sleeper user, independent of any single league-season. */
export type Owner = {
  ownerId: string;
  displayName: string;
  teamName: string | null;
};
