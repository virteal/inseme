/**
 * Resolve the subject supplied by a trusted COP host runtime.
 * Tool arguments are untrusted conversational input and must never select it.
 */
export function runtimeSubject(runtime) {
  const subject =
    runtime?.access_context?.subject_ref ||
    runtime?.subject_ref ||
    runtime?.user?.subject_ref ||
    (runtime?.user?.id ? `subject:auth:${runtime.user.id}` : null);
  return subject || null;
}
