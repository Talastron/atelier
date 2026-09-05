// A sequential queue for background removal.
//
// Module-level on purpose: the work has to outlive the Add Item modal, which
// unmounts on save. A queue owned by the component would be torn down mid-job
// and the user would lose the cut-out they had already waited part-way for.
//
// Sequential on purpose too. Background removal is heavy WASM; several at once
// risks exhausting memory on a phone, which is exactly where photo intake
// hurts most. Non-blocking is not the same as concurrent — the user is simply
// no longer waiting on the queue.
//
// The job carries its own work function rather than the queue importing the
// model. That keeps this file pure orchestration, and lets its tests run
// without ever loading the WASM.
const queue = [];
let running = false;
let nextId = 1;

function pump() {
  if (running) return;
  const job = queue[0];
  if (!job) return;
  running = true;
  Promise.resolve()
    .then(() => job.run())
    .then(
      (result) => { try { job.onDone?.(result); } catch { /* a handler must not stall the queue */ } },
      (err) => { try { job.onError?.(err); } catch { /* nor must its error path */ } },
    )
    .then(() => {
      queue.shift();
      running = false;
      pump();
    });
}

// job: { run: () => Promise<result>, onDone?, onError? } → job id
export function enqueueCutout(job) {
  const id = nextId++;
  queue.push({ ...job, id });
  pump();
  return id;
}

// Re-point a job that has not finished yet. Used when the modal saves and
// hands its remaining work over to the item-patching path.
export function retarget(id, handlers) {
  const job = queue.find((j) => j.id === id);
  if (!job) return false;
  Object.assign(job, handlers);
  return true;
}

export function pendingCount() {
  return queue.length;
}
