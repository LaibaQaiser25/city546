import { LIMITS } from '../../config/site';
import { isValidImageRef } from '../../utils/format';

/**
 * Client-side validation — mirrors the server rules for fast feedback.
 * The API re-validates everything; this is never the only line of defence.
 * Keys match the server's `details[].field` paths (e.g. "blocks.2.url").
 */
export function validatePost(values) {
  const errors = {};
  const heading = values.heading.trim();
  const description = values.description.trim();

  if (!values.imageUrl) errors.imageUrl = 'An image is required — choose a photo or paste a link';
  else if (!isValidImageRef(values.imageUrl)) errors.imageUrl = 'Image must be an uploaded photo or a valid http(s) URL';

  if (!heading) errors.heading = 'Heading is required';
  else if (heading.length < LIMITS.HEADING_MIN) errors.heading = `Heading must be at least ${LIMITS.HEADING_MIN} characters`;
  else if (heading.length > LIMITS.HEADING_MAX) errors.heading = `Heading must be at most ${LIMITS.HEADING_MAX} characters`;

  if (!description) errors.description = 'Description is required';
  else if (description.length < LIMITS.DESCRIPTION_MIN) errors.description = `Description must be at least ${LIMITS.DESCRIPTION_MIN} characters`;
  else if (description.length > LIMITS.DESCRIPTION_MAX) errors.description = `Description must be at most ${LIMITS.DESCRIPTION_MAX} characters`;

  if (values.blocks.length > LIMITS.BLOCKS_MAX) errors.blocks = `A post can have at most ${LIMITS.BLOCKS_MAX} extra blocks`;

  values.blocks.forEach((block, i) => {
    if (block.type === 'image') {
      if (!block.url) errors[`blocks.${i}.url`] = 'Choose a photo or remove this block';
      else if (!isValidImageRef(block.url)) errors[`blocks.${i}.url`] = 'Must be an uploaded photo or a valid http(s) URL';
      if ((block.caption || '').length > LIMITS.CAPTION_MAX) errors[`blocks.${i}.caption`] = `Caption must be at most ${LIMITS.CAPTION_MAX} characters`;
    } else {
      const max = block.type === 'heading' ? LIMITS.BLOCK_HEADING_MAX : LIMITS.BLOCK_TEXT_MAX;
      const text = (block.text || '').trim();
      if (!text) errors[`blocks.${i}.text`] = `Write something or remove this ${block.type === 'heading' ? 'sub-heading' : 'paragraph'}`;
      else if (text.length > max) errors[`blocks.${i}.text`] = `Must be at most ${max} characters`;
    }
  });

  return errors;
}

/** Normalises form values into the API payload. */
export function toApiPayload(values) {
  return {
    imageUrl: values.imageUrl.trim(),
    heading: values.heading.trim(),
    description: values.description.trim(),
    categoryId: values.categoryId ? Number(values.categoryId) : null,
    published: values.published,
    blocks: values.blocks.map((b) =>
      b.type === 'image'
        ? { id: b.id, type: 'image', url: b.url.trim(), caption: (b.caption || '').trim() }
        : { id: b.id, type: b.type, text: b.text.trim() },
    ),
  };
}
