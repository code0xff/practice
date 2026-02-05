import { sessions, sessionMap } from '$lib/data/sessions';
import type { EntryGenerator } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => {
  return sessions.map((session) => ({ slug: session.slug }));
};

export const load = ({ params }) => {
  const session = sessionMap.get(params.slug);
  if (!session) {
    return { session: null };
  }

  return { session };
};
