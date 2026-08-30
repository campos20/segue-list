import type { SongManifest } from "@/types/song";

/** Every distinct tag used by at least one of `songs`, alphabetically. */
export function collectTags(songs: SongManifest[]): string[] {
  const set = new Set<string>();
  for (const song of songs) {
    for (const tag of song.tags ?? []) set.add(tag);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Song ids in alphabetical order by name. `Array.prototype.sort` is a stable sort, so two same-named songs keep their current relative order. */
export function sortAlphabetically(songs: SongManifest[]): string[] {
  return [...songs]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((song) => song.id);
}

/**
 * Song ids grouped by `tagPriority`: every song carrying `tagPriority[0]`
 * comes first (in its current relative order), then every remaining song
 * carrying `tagPriority[1]`, and so on. A song matching more than one
 * listed tag is placed by the earliest one, so it isn't duplicated. Any
 * song matching none of `tagPriority` keeps its current relative order at
 * the end, after every prioritized group.
 */
export function sortByTagPriority(
  songs: SongManifest[],
  tagPriority: string[],
): string[] {
  const groups: SongManifest[][] = tagPriority.map(() => []);
  const rest: SongManifest[] = [];

  for (const song of songs) {
    const tags = song.tags ?? [];
    const groupIndex = tagPriority.findIndex((tag) => tags.includes(tag));
    if (groupIndex === -1) {
      rest.push(song);
      continue;
    }
    groups[groupIndex].push(song);
  }

  return [...groups.flat(), ...rest].map((song) => song.id);
}
