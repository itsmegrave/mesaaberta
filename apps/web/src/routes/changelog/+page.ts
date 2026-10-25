import { error } from '@sveltejs/kit';
import { releasePage } from '#lib/changelog.js';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
  const data = releasePage(url.searchParams.get('tipo'), url.searchParams.get('page'));
  if (data.page > data.pages) error(404);
  return data;
};
