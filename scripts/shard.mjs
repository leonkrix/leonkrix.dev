/**
 * Splits a list into the part that belongs to one shard of a run that is spread over several
 * machines (`--shard 2/3`: the second of three). The CI runs the Lighthouse gate as three jobs at
 * once, each on its own machine, so that the measurements do not disturb each other and the whole
 * run is a third as long. Every item belongs to exactly one shard (the items are dealt out one after
 * the other), so no page is skipped or measured twice; a test checks that.
 */

/**
 * "2/3" becomes { index: 2, count: 3 }; anything else is an error
 * @param {string | undefined} spec
 * @returns {{ index: number, count: number }}
 */
export function parseShard(spec) {
  const match = /^(\d+)\/(\d+)$/.exec(spec ?? '');
  const index = Number(match?.[1]);
  const count = Number(match?.[2]);
  if (!match || count < 1 || index < 1 || index > count) {
    throw new Error(`Invalid --shard "${String(spec)}": write it as 2/3 (the second of three).`);
  }
  return { index, count };
}

/**
 * The items of one shard, in their order
 * @template T
 * @param {readonly T[]} items
 * @param {string | undefined} spec
 * @returns {T[]}
 */
export function takeShard(items, spec) {
  const { index, count } = parseShard(spec);
  return items.filter((_, position) => position % count === index - 1);
}
