export default function TodoSettingsPage() {
  return (
    <section>
      <h2>Wuff Todo</h2>
      <p className="settings-description">
        Your lists, task views and overview choices stay in Todo.
      </p>
      <a className="empire-text-link" href="/lists?home=1">
        Open Todo overview
      </a>
      <p>
        Use Customize Overview there to choose Today, Coming up, Favorites and
        whether Todo opens your last list.
      </p>
      <a className="empire-text-link" href="/settings/reminders">
        Todo reminder schedules
      </a>
    </section>
  );
}
