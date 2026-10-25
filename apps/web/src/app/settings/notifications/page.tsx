import { GlobalNotificationControls } from "./global-controls";
import { pageActor } from "@/lib/auth/server";
import { getReminderSettings, getNotificationSettings } from "@wuff/domain";
import { ReminderSettingsForm } from "../reminders/settings-form";
export default async function NotificationsPage() {
  const actor = await pageActor();
  return (
    <>
      <GlobalNotificationControls
        initial={await getNotificationSettings(actor)}
      />
      <ReminderSettingsForm
        initial={await getReminderSettings(actor)}
        userId={actor.id}
        mode="delivery"
      />
    </>
  );
}
