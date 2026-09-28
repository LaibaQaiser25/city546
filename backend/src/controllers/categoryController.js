import * as Category from '../models/categoryModel.js';
import { ok } from '../utils/respond.js';

export async function list(_req, res) {
  const categories = await Category.listWithCounts();
  return ok(
    res,
    categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, postCount: c.post_count })),
  );
}
