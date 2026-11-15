/**
 * Plain-language visitor copy (Alexandra task 6).
 */

export const STATUS_COPY = {
  loading: 'Loading this specimen…',

  apiDownTitle: 'Server unavailable',
  apiDownBody:
    'We could not reach the Marrow server. Check that the API is running, then try again. Pins you already saved stay in this browser only.',
  apiDownRetry: 'Try again',

  meshFailTitle: 'Some 3D parts could not be shown',
  meshFailBody:
    'At least one bone is missing or unreadable in the prepared inventory. Marrow will not invent a picture to fill the gap — see the anatomy list for status.',

  meshNoneTitle: 'No 3D meshes ready yet',
  meshNoneBody:
    'Nothing in this study is marked ready to display in 3D yet. Attribution and notes can still work when prepared meshes arrive.',

  loadErrorTitle: 'Could not open this specimen',
  loadErrorBody:
    'Something went wrong while opening the study. Go back to start and open the curated specimen again.',
} as const
