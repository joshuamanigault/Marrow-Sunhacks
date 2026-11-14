/**
 * Plain-language visitor copy for empty / error states
 * (Alexandra roadmap task 6).
 *
 * Keep wording short, calm, and free of stack traces or jargon.
 */

export const STATUS_COPY = {
  /** Shown while credits/structures are loading */
  loading: "Loading this specimen…",

  /** API /health or specimen fetch could not be reached */
  apiDownTitle: "Server unavailable",
  apiDownBody:
    "We could not reach the Marrow server right now. You can still explore the curated local copy of this study. Pins you save stay in this browser only.",

  /** Retry hint under API-down banner */
  apiDownRetry: "Try again",

  /** One or more meshes cannot be shown in 3D */
  meshFailTitle: "Some 3D parts could not be shown",
  meshFailBody:
    "At least one bone mesh is missing, unreadable, or failed to load. Marrow will not invent a picture to fill the gap — check Prepared structures for which parts are ready.",

  /** Zero ready meshes for the stage */
  meshNoneTitle: "No 3D meshes ready yet",
  meshNoneBody:
    "Nothing in this study is marked ready to display in 3D. Attribution and notes can still work; the fossil model will appear when prepared meshes are available.",

  /** Pin list empty state */
  noPinsTitle: "No pins yet",
  noPinsBody:
    "Select a bone, add a short note about what you noticed, then save. Pins stay on this device only and come back when you reopen the same specimen.",

  /** Generic load failure (unknown id, bad response) */
  loadErrorTitle: "Could not open this specimen",
  loadErrorBody:
    "Something went wrong while opening the study. Go back to start and open the curated specimen again.",
} as const
