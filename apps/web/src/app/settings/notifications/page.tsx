import { pageActor } from "@/lib/auth/server";
import { getReminderSettings } from "@wuff/domain";
import { ReminderSettingsForm } from "../reminders/settings-form";
export default async function NotificationsPage() {
  const actor = await pageActor();
  return (
    <ReminderSettingsForm
      initial={await getReminderSettings(actor)}
      userId={actor.id}
      mode="delivery"
    />
  );
}
