import { describe, expect, it } from 'vitest';
import { cannyLinks } from './links';

describe('cannyLinks', () => {
  it('reads both URLs from the deployment variables', () => {
    expect(
      cannyLinks({
        CANNY_FEEDBACK_URL: 'https://games.canny.io/feedback',
        CANNY_CHANGELOG_URL: ' https://games.canny.io/changelog ',
      }),
    ).toEqual({
      feedbackUrl: 'https://games.canny.io/feedback',
      changelogUrl: 'https://games.canny.io/changelog',
    });
  });

  it('hides a link whose variable is missing, blank or not a plain web URL', () => {
    expect(cannyLinks(undefined)).toEqual({ feedbackUrl: null, changelogUrl: null });
    expect(
      cannyLinks({ CANNY_FEEDBACK_URL: '', CANNY_CHANGELOG_URL: 'javascript:alert(1)' }),
    ).toEqual({ feedbackUrl: null, changelogUrl: null });
    expect(cannyLinks({ CANNY_FEEDBACK_URL: 'https://user:pass@games.canny.io/' })).toEqual({
      feedbackUrl: null,
      changelogUrl: null,
    });
  });
});
