import { catalog } from './catalog';
import { type Category } from './define';
import { type ShardId, shardLoaders } from './shards';

const shardOf = new Map(catalog);
const loaded = new Map<ShardId, Promise<readonly Category[]>>();

/** The categories of one file, fetched once (a failed fetch is forgotten so that it can be retried). */
function loadShard(shard: ShardId): Promise<readonly Category[]> {
  let promise = loaded.get(shard);
  if (promise === undefined) {
    promise = shardLoaders[shard]();
    loaded.set(shard, promise);
    promise.catch(() => {
      loaded.delete(shard);
    });
  }
  return promise;
}

/** The categories with these ids, in the same order. Only the files that hold them are fetched. */
export async function loadCategories(ids: readonly string[]): Promise<readonly Category[]> {
  return Promise.all(
    ids.map(async (id) => {
      const shard = shardOf.get(id);
      if (shard === undefined) {
        throw new Error(`Unknown category: ${id}`);
      }
      const category = (await loadShard(shard)).find((entry) => entry.id === id);
      if (category === undefined) {
        throw new Error(`Category ${id} is missing from ${shard}`);
      }
      return category;
    }),
  );
}
