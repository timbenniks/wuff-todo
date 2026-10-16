// Server-only SQL definitions. Identity parameters come from the authenticated
// Actor in getLiveQuery, never from a caller-supplied user ID.
const visible = `EXISTS (SELECT 1 FROM wuff_users u WHERE u.id = $1 AND u.enabled = true)
  AND (l.owner_id = $1 OR EXISTS (
    SELECT 1 FROM wuff_members m WHERE m.list_id = l.id AND m.user_id = $1
  ))`;
const columns = `l.id, l.title, l.owner_id AS "ownerId", l.version, l.color, l.archived, COALESCE(p.version, 0) AS "orderVersion"`;
export function liveQueryDefinition(userId: string) {
  return {
    query: `SELECT ${columns} FROM wuff_lists l LEFT JOIN wuff_list_preferences p ON p.user_id = $1 WHERE ${visible} ORDER BY l.created_at, l.id`,
    params: [userId],
  };
}
