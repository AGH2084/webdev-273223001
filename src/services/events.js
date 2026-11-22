function eventsService(data, auth, clock = () => new Date()) {
  return {
    async list(token) {
      const user = await auth.requireUser(token);
      const events = (await data.upcoming(clock().toISOString())).map(row => ({
        id: row.id, title: row.title, description: row.description,
        startsAt: row.starts_at, venue: row.venue, club: row.club,
        capacity: row.capacity, freePlaces: Math.max(0, row.capacity - row.registered),
      }));
      return { user, events };
    },
  };
}
module.exports = { eventsService };
