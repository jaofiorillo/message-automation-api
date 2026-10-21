import type { Draft } from '../../api/types';
import { defaultCaption } from '../model';

export const newStepValue = '__new__';

// Options for "which step comes next": the other steps, by caption.
export function StepOptions({
  draft,
  exclude,
}: {
  draft: Draft;
  exclude?: string;
}) {
  return (
    <>
      {draft.contents
        .filter((content) => content.oid !== exclude)
        .map((content, index) => (
          <option key={content.oid} value={content.oid}>
            {content.caption || defaultCaption} #{index + 1}
          </option>
        ))}
      <option value={newStepValue}>+ Nova etapa</option>
    </>
  );
}
