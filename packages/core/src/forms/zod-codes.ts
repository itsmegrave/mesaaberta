import { z } from 'zod';

// A field error is a short code ("too_small", "invalid_format"), not English text: the form turns the
// code into a sentence in the reader's language. An explicit message (a refine that names its own
// code, such as 'mismatch') is kept as it is.
z.config({ customError: (issue) => (issue.code === 'custom' ? undefined : issue.code) });
