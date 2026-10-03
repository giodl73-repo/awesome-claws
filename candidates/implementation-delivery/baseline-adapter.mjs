// Deliberately incomplete baseline for the synthetic regression experiment.
export function mapTickets(tickets) {
  return tickets.map(({ id, userId, status }) => ({ id, assigneeId: userId, state: status }));
}
export function restoreSnapshot(snapshot) {
  return snapshot;
}
