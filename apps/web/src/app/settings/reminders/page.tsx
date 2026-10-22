import { pageActor } from "@/lib/auth/server";
import { getReminderSettings } from "@wuff/domain";
import { ReminderSettingsForm } from "./settings-form";
export default async function Page() {
  const actor = await pageActor();
  return (
    <ReminderSettingsForm
      initial={await getReminderSettings(actor)}
      userId={actor.id}
    />
  );
}
