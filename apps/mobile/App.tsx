import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { randomUUID } from "expo-crypto";
import { ClientError, PendingMutation } from "@wuff/client";
import {
  dueDateSchema,
  listColors,
  projectListView,
  defaultListView,
  statusLabels,
  taskPriorities,
  taskStatuses,
  type IncomingInvitation,
  type ListColor,
  type ListSharing,
  type ListSummary,
  type Task,
  type TodoList,
} from "@wuff/contracts";
import { listPalette, listThemeVariables } from "@wuff/design";
import { client, signIn } from "./src/session";

const colors = (color: ListColor) => {
  const t = listThemeVariables(color);
  return {
    primary: t["--wuff-primary"],
    background: t["--wuff-background"],
    surface: t["--wuff-surface"],
    foreground: t["--wuff-foreground"],
    muted: t["--wuff-muted"],
    border: t["--wuff-control"],
    tint: t["--wuff-accent"],
  };
};
const Theme = createContext(colors("blue"));
function Label({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  const theme = useContext(Theme);
  return (
    <Text style={[s.text, { color: muted ? theme.muted : theme.foreground }]}>
      {children}
    </Text>
  );
}
function Button({
  title,
  onPress,
  disabled = false,
  primary = false,
  danger = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  const theme = useContext(Theme);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          borderColor: danger ? "#a52e3b" : theme.border,
          backgroundColor: primary ? theme.primary : theme.surface,
          opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text
        style={[
          s.text,
          {
            color: primary ? "#ffffff" : danger ? "#a52e3b" : theme.foreground,
          },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
function Field({ label, ...props }: TextInputProps & { label: string }) {
  const theme = useContext(Theme);
  return (
    <View style={s.field}>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.muted}
        {...props}
        style={[
          s.input,
          {
            color: theme.foreground,
            borderColor: theme.border,
            backgroundColor: theme.surface,
          },
          props.style,
        ]}
      />
    </View>
  );
}
function Choices<T extends string>({
  label,
  values,
  value,
  onChange,
  labels,
  disabled = false,
}: {
  label: string;
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
  labels?: Partial<Record<T, string>>;
  disabled?: boolean;
}) {
  return (
    <View style={s.field}>
      <Label>{label}</Label>
      <View style={s.wrap}>
        {values.map((v) => (
          <Button
            key={v}
            disabled={disabled}
            title={`${value === v ? "✓ " : ""}${labels?.[v] ?? v}`}
            onPress={() => onChange(v)}
          />
        ))}
      </View>
    </View>
  );
}
type Edit = { task: Task; version: number };
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Ruff patch! Please try again.";

export default function App() {
  const [fonts, fontError] = useFonts({
    DMSans: require("./assets/dm-sans.ttf"),
    DMSansItalic: require("./assets/dm-sans-italic.ttf"),
  });
  return (
    <SafeAreaProvider>
      {fonts || fontError ? (
        <Wuff />
      ) : (
        <View style={s.loading}>
          <ActivityIndicator accessibilityLabel="Loading Wuff" />
        </View>
      )}
    </SafeAreaProvider>
  );
}

function Wuff() {
  const [signedIn, setSignedIn] = useState(false),
    [ready, setReady] = useState(false);
  const [userId, setUserId] = useState("");
  const [lists, setLists] = useState<ListSummary[]>([]),
    [list, setList] = useState<TodoList | null>(null);
  const [invitations, setInvitations] = useState<IncomingInvitation[]>([]);
  const [edit, setEdit] = useState<Edit | null>(null),
    [settings, setSettings] = useState(false);
  const [sharing, setSharing] = useState<ListSharing | null>(null);
  const [busy, setBusy] = useState(false),
    [refreshing, setRefreshing] = useState(false);
  const [active, setActive] = useState(AppState.currentState === "active");
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [title, setTitle] = useState(""),
    [listTitle, setListTitle] = useState("");
  const [, bump] = useState(0);
  const mutation = useRef(new PendingMutation(client)).current;
  const listRef = useRef<TodoList | null>(null),
    epoch = useRef(0),
    working = useRef(false),
    refreshingRef = useRef(false);
  const mounted = useRef(true);
  const refreshAgain = useRef(false);
  const afterRetry = useRef<(() => void) | undefined>(undefined);
  const theme = colors(list?.color ?? "blue");
  function select(value: TodoList | null) {
    listRef.current = value;
    setList(value);
  }
  function clear() {
    epoch.current++;
    mutation.clear();
    afterRetry.current = undefined;
    setSignedIn(false);
    setUserId("");
    setLists([]);
    select(null);
    setInvitations([]);
    setSharing(null);
    setEdit(null);
    setSettings(false);
    setTitle("");
    setListTitle("");
    setNotice("");
  }
  async function refresh(force = false) {
    if (refreshingRef.current) {
      if (force) refreshAgain.current = true;
      return;
    }
    refreshingRef.current = true;
    setRefreshing(true);
    const run = epoch.current,
      selected = listRef.current?.id;
    try {
      const [catalog, inbox] = await Promise.all([
        client.lists(),
        client.call<IncomingInvitation[]>("listInvitations"),
      ]);
      const snapshot =
        selected && catalog.some((l) => l.id === selected)
          ? await client.list(selected)
          : null;
      if (run !== epoch.current || !mounted.current) return;
      setLists(catalog);
      setInvitations(inbox);
      if (selected === listRef.current?.id) select(snapshot);
      if (selected && !snapshot) {
        setEdit(null);
        setSettings(false);
        setSharing(null);
        setError("That list is no longer available.");
      }
    } catch (e) {
      if (run !== epoch.current || !mounted.current) return;
      if (e instanceof ClientError && [401, 403, 404].includes(e.status)) {
        // Never keep revoked list data on screen after a denied authoritative read.
        select(null);
        setLists([]);
        setSharing(null);
        setEdit(null);
        setSettings(false);
      }
      setError(message(e));
    } finally {
      refreshingRef.current = false;
      if (mounted.current) setRefreshing(false);
      if (refreshAgain.current && mounted.current) {
        refreshAgain.current = false;
        void refresh();
      }
    }
  }
  useEffect(() => {
    mounted.current = true;
    client.onSignedOut = clear;
    void (async () => {
      try {
        if (await client.restore()) {
          const session = await client.call<{ userId: string }>("session");
          if (!mounted.current) return;
          setUserId(session.userId);
          setSignedIn(true);
          await refresh();
        }
      } catch (e) {
        if (mounted.current) setError(message(e));
      } finally {
        if (mounted.current) setReady(true);
      }
    })();
    return () => {
      mounted.current = false;
      epoch.current++;
      client.onSignedOut = () => {};
    };
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setActive(state === "active");
      if (state === "active" && signedIn && !working.current) void refresh();
    });
    const timer = setInterval(() => {
      if (
        AppState.currentState === "active" &&
        signedIn &&
        !working.current &&
        !mutation.hasPending
      )
        void refresh();
    }, 10_000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [signedIn]);
  const goBack = () => {
    if (edit) {
      Alert.alert("Discard task changes?", "Your unsaved edits will be lost.", [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => setEdit(null) },
      ]);
      return true;
    }
    if (sharing) {
      setSharing(null);
      return true;
    }
    if (settings) {
      setSettings(false);
      return true;
    }
    if (list) {
      epoch.current++;
      select(null);
      return true;
    }
    return false;
  };
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (working.current || mutation.hasPending) return true;
        return goBack();
      },
    );
    return () => subscription.remove();
  }, [edit, settings, sharing, list]);

  async function perform(action: string, input: unknown, done?: () => void) {
    if (working.current || mutation.hasPending) return;
    working.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    epoch.current++;
    afterRetry.current = done;
    try {
      await mutation.run(action, input);
      done?.();
      afterRetry.current = undefined;
      setNotice("Saved. Good work, pack!");
    } catch (e) {
      setError(message(e));
    } finally {
      working.current = false;
      setBusy(false);
      bump((n) => n + 1);
      if (!mutation.hasPending) await refresh(true);
    }
  }
  async function retry() {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      await mutation.retry();
      afterRetry.current?.();
      afterRetry.current = undefined;
      setNotice("Saved.");
    } catch (e) {
      setError(message(e));
    } finally {
      working.current = false;
      setBusy(false);
      bump((n) => n + 1);
      if (!mutation.hasPending) await refresh(true);
    }
  }
  const locked = busy || refreshing || mutation.hasPending || !active;
  const change = (
    action: string,
    fields: Record<string, unknown>,
    done?: () => void,
    version = list?.version,
  ) => {
    if (!list || version === undefined) return;
    void perform(
      action,
      { listId: list.id, version, operationId: randomUUID(), ...fields },
      done,
    );
  };
  async function openList(id: string) {
    if (locked) return;
    const run = ++epoch.current;
    setBusy(true);
    setError("");
    setNotice("");
    setTitle("");
    try {
      const result = await client.list(id);
      if (run === epoch.current) select(result);
    } catch (e) {
      if (run === epoch.current) setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function connect() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (await signIn()) {
        const session = await client.call<{ userId: string }>("session");
        setUserId(session.userId);
        setSignedIn(true);
        await refresh();
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function taskRow(task: Task, child = false) {
    const children = list!.tasks.filter((t) => t.parentTaskId === task.id);
    return (
      <View key={task.id} style={child ? s.child : s.taskBlock}>
        <View style={s.row}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={task.title}
            accessibilityState={{
              checked: task.completed,
              disabled: locked || list!.archived,
            }}
            disabled={locked || list!.archived}
            onPress={() =>
              change("updateTask", {
                taskId: task.id,
                completed: !task.completed,
              })
            }
            style={[
              s.check,
              {
                borderColor: theme.border,
                backgroundColor: task.completed ? theme.primary : theme.surface,
              },
            ]}
          >
            <Text style={{ color: "#ffffff", fontSize: 20 }}>
              {task.completed ? "✓" : ""}
            </Text>
          </Pressable>
          <Pressable
            disabled={locked}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${task.title}`}
            onPress={() => {
              setEdit({ task: { ...task }, version: list!.version });
              setNotice("");
            }}
            style={s.taskName}
          >
            <Text
              style={[
                s.text,
                {
                  color: theme.foreground,
                  textDecorationLine: task.completed ? "line-through" : "none",
                },
              ]}
            >
              {task.title}
            </Text>
            <Text style={[s.caption, { color: theme.muted }]}>
              {[
                list!.mode === "work" &&
                  `${task.key} · ${statusLabels[task.status]}`,
                task.dueDate && `Due ${task.dueDate}`,
                children.length > 0 &&
                  `${children.filter((t) => t.completed).length}/${children.length} subtasks`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </Pressable>
        </View>
        {children.map((t) => taskRow(t, true))}
      </View>
    );
  }
  const groups = list
    ? projectListView(
        list,
        list.personalView?.view ?? defaultListView(),
        today(),
      )
    : [];
  return (
    <Theme.Provider value={theme}>
      <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          style={s.safe}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {!ready ? (
            <View style={s.loading}>
              <ActivityIndicator accessibilityLabel="Restoring sign-in" />
            </View>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={s.page}
              refreshControl={
                signedIn && !edit && !settings && !sharing ? (
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => {
                      if (!locked) void refresh();
                    }}
                    tintColor={theme.primary}
                  />
                ) : undefined
              }
            >
              <View style={s.header}>
                <Image
                  source={require("./assets/waffles.png")}
                  accessibilityLabel="Waffles the corgi"
                  style={s.mascot}
                />
                <View style={s.grow}>
                  <Text style={[s.brand, { color: theme.foreground }]}>
                    Wuff Todo
                  </Text>
                  <Label muted>
                    {signedIn
                      ? "Your pack, in your pocket."
                      : "A little help for your everyday."}
                  </Label>
                </View>
              </View>
              {error ? (
                <View accessibilityRole="alert" style={s.feedback}>
                  <Text style={[s.text, { color: "#a52e3b" }]}>{error}</Text>
                  {mutation.hasPending ? (
                    <>
                      <Label>
                        Your change may have saved. Retry checks the same change
                        safely.
                      </Label>
                      <Button
                        title="Retry pending change"
                        disabled={busy}
                        onPress={() => void retry()}
                      />
                    </>
                  ) : signedIn ? (
                    <Button
                      title="Refresh"
                      disabled={busy}
                      onPress={() => {
                        setError("");
                        void refresh();
                      }}
                    />
                  ) : null}
                </View>
              ) : null}
              {notice ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={[s.text, { color: theme.muted }]}
                >
                  {notice}
                </Text>
              ) : null}
              {!active && signedIn ? (
                <Label>
                  Wuff is paused while the app is in the background.
                </Label>
              ) : null}
              {!signedIn ? (
                <View style={s.stack}>
                  <Text style={[s.heading, { color: theme.foreground }]}>
                    Welcome to the pack.
                  </Text>
                  <Label>
                    Sign in with your invited Wuff account. Your lists stay in
                    sync with the website.
                  </Label>
                  <Button
                    primary
                    title={busy ? "Connecting…" : "Sign in to Wuff"}
                    disabled={busy}
                    onPress={() => void connect()}
                  />
                  <Label muted>
                    Wuff needs an internet connection to load lists and save
                    changes.
                  </Label>
                </View>
              ) : (
                <>
                  <View style={s.row}>
                    {list && (
                      <Button title="Back" disabled={locked} onPress={goBack} />
                    )}
                    <View style={s.grow} />
                    <Button
                      title="Sign out"
                      disabled={busy}
                      onPress={() => {
                        Alert.alert(
                          "Sign out of Wuff?",
                          "Unsaved edits will be discarded on this phone.",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Sign out",
                              onPress: () => {
                                void client
                                  .signOut()
                                  .catch((e) => setError(message(e)));
                              },
                            },
                          ],
                        );
                      }}
                    />
                  </View>
                  {!list ? (
                    <View style={s.stack}>
                      <Text style={[s.heading, { color: theme.foreground }]}>
                        Your list pack
                      </Text>
                      {lists.length === 0 && (
                        <Label>No lists yet. Let’s fetch your first one.</Label>
                      )}
                      {lists.map((item) => (
                        <Pressable
                          key={item.id}
                          accessibilityRole="button"
                          disabled={locked}
                          onPress={() => void openList(item.id)}
                          style={[
                            s.listCard,
                            {
                              backgroundColor: theme.surface,
                              borderColor: theme.border,
                            },
                          ]}
                        >
                          <View
                            style={[
                              s.dot,
                              {
                                backgroundColor: listPalette[item.color].accent,
                              },
                            ]}
                          />
                          <View style={s.grow}>
                            <Label>{item.title}</Label>
                            <Label muted>
                              {item.archived
                                ? "Archived"
                                : item.ownerId === userId
                                  ? "Your list"
                                  : "Shared with you"}
                            </Label>
                          </View>
                          <Label>›</Label>
                        </Pressable>
                      ))}
                      <Field
                        label="New list"
                        value={listTitle}
                        onChangeText={setListTitle}
                        maxLength={300}
                        editable={!locked}
                        placeholder="A name for your list"
                      />
                      <Button
                        primary
                        title="Create list"
                        disabled={locked || !listTitle.trim()}
                        onPress={() =>
                          void perform(
                            "createList",
                            {
                              title: listTitle.trim(),
                              operationId: randomUUID(),
                            },
                            () => setListTitle(""),
                          )
                        }
                      />
                      {invitations.length > 0 && (
                        <Text
                          style={[s.subheading, { color: theme.foreground }]}
                        >
                          Invitations
                        </Text>
                      )}
                      {invitations.map((invitation) => (
                        <View key={invitation.id} style={s.stack}>
                          <Label>
                            {invitation.ownerName} invited you to{" "}
                            {invitation.listTitle}
                          </Label>
                          <View style={s.wrap}>
                            {[true, false].map((accept) => (
                              <Button
                                key={String(accept)}
                                title={accept ? "Accept" : "Decline"}
                                disabled={locked}
                                onPress={() =>
                                  void perform("respondToInvitation", {
                                    invitationId: invitation.id,
                                    accept,
                                    operationId: randomUUID(),
                                  })
                                }
                              />
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : edit ? (
                    <TaskEditor
                      key={edit.task.id}
                      edit={edit}
                      list={list}
                      locked={locked}
                      onSave={(fields) =>
                        change(
                          "updateTask",
                          { taskId: edit.task.id, ...fields },
                          () => setEdit(null),
                          edit.version,
                        )
                      }
                      onDelete={() =>
                        Alert.alert(
                          "Delete task?",
                          "This permanently deletes the task and its subtasks.",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Delete",
                              style: "destructive",
                              onPress: () =>
                                change(
                                  "deleteTask",
                                  { taskId: edit.task.id },
                                  () => setEdit(null),
                                  edit.version,
                                ),
                            },
                          ],
                        )
                      }
                      onLatest={() => {
                        const current = list.tasks.find(
                          (t) => t.id === edit.task.id,
                        );
                        if (current)
                          setEdit({
                            task: { ...current },
                            version: list.version,
                          });
                        else setEdit(null);
                      }}
                      onMove={(direction) => {
                        const siblings = list.tasks
                          .filter(
                            (t) => t.parentTaskId === edit.task.parentTaskId,
                          )
                          .sort((a, b) => a.position - b.position);
                        const index = siblings.findIndex(
                            (t) => t.id === edit.task.id,
                          ),
                          target = index + direction;
                        if (
                          index < 0 ||
                          target < 0 ||
                          target >= siblings.length
                        )
                          return;
                        [siblings[index], siblings[target]] = [
                          siblings[target],
                          siblings[index],
                        ];
                        change(
                          "reorderTasks",
                          {
                            parentTaskId: edit.task.parentTaskId,
                            taskIds: siblings.map((t) => t.id),
                          },
                          () => setEdit(null),
                          edit.version,
                        );
                      }}
                      onSubtask={(name, done) =>
                        change(
                          "createTask",
                          { title: name, parentTaskId: edit.task.id },
                          done,
                        )
                      }
                    />
                  ) : sharing ? (
                    <Sharing
                      list={list}
                      sharing={sharing}
                      owner={userId === list.ownerId}
                      locked={locked}
                      mutate={(action, fields) =>
                        change(action, fields, () => setSharing(null))
                      }
                    />
                  ) : settings ? (
                    <ListSettings
                      key={list.id}
                      list={list}
                      owner={userId === list.ownerId}
                      locked={locked}
                      onSave={(fields) =>
                        change("updateList", fields, () => setSettings(false))
                      }
                      onDelete={() =>
                        Alert.alert(
                          "Delete list?",
                          "This permanently deletes this list, all its tasks and its sharing access.",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Delete list",
                              style: "destructive",
                              onPress: () =>
                                change("deleteList", {}, () => {
                                  setSettings(false);
                                  select(null);
                                }),
                            },
                          ],
                        )
                      }
                      onLeave={() =>
                        Alert.alert(
                          "Leave this list?",
                          "You’ll need another invitation to return.",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Leave list",
                              style: "destructive",
                              onPress: () =>
                                change("leaveList", {}, () => {
                                  setSettings(false);
                                  select(null);
                                }),
                            },
                          ],
                        )
                      }
                    />
                  ) : (
                    <View style={s.stack}>
                      <Text style={[s.heading, { color: theme.foreground }]}>
                        {list.title}
                      </Text>
                      {list.description ? (
                        <Label muted>{list.description}</Label>
                      ) : null}
                      <View style={s.wrap}>
                        <Button
                          title="List settings"
                          disabled={locked}
                          onPress={() => setSettings(true)}
                        />
                        <Button
                          title="Sharing"
                          disabled={locked}
                          onPress={() => {
                            const run = epoch.current,
                              id = list.id;
                            setBusy(true);
                            void client
                              .call<ListSharing>("getListSharing", id)
                              .then((value) => {
                                if (
                                  run === epoch.current &&
                                  listRef.current?.id === id
                                )
                                  setSharing(value);
                              })
                              .catch((e) => setError(message(e)))
                              .finally(() => setBusy(false));
                          }}
                        />
                      </View>
                      {list.archived ? (
                        <Label>
                          This list is archived. Its owner can restore it in
                          list settings.
                        </Label>
                      ) : (
                        <>
                          <Field
                            label="Add a task"
                            placeholder="What needs doing?"
                            value={title}
                            onChangeText={setTitle}
                            maxLength={300}
                            editable={!locked}
                            onSubmitEditing={() => {
                              if (!locked && title.trim())
                                change(
                                  "createTask",
                                  { title: title.trim() },
                                  () => setTitle(""),
                                );
                            }}
                            returnKeyType="done"
                          />
                          <Button
                            primary
                            title="Add task"
                            disabled={locked || !title.trim()}
                            onPress={() =>
                              change(
                                "createTask",
                                { title: title.trim() },
                                () => setTitle(""),
                              )
                            }
                          />
                        </>
                      )}
                      {list.personalView && (
                        <Label muted>Your saved list view</Label>
                      )}
                      {groups
                        .filter((g) => g.tasks.length)
                        .map((group) => (
                          <View key={group.id} style={s.stack}>
                            <Text
                              style={[
                                s.subheading,
                                { color: theme.foreground },
                              ]}
                            >
                              {group.title} · {group.tasks.length}
                            </Text>
                            {group.tasks.map((task) => taskRow(task))}
                          </View>
                        ))}
                      {!groups.some((g) => g.tasks.length) && (
                        <Label muted>
                          No tasks in this view. A little breathing room.
                        </Label>
                      )}
                    </View>
                  )}
                </>
              )}
              {busy && (
                <ActivityIndicator
                  accessibilityLabel="Saving or loading"
                  color={theme.primary}
                />
              )}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Theme.Provider>
  );
}

function TaskEditor({
  edit,
  list,
  locked,
  onSave,
  onDelete,
  onLatest,
  onSubtask,
  onMove,
}: {
  edit: Edit;
  list: TodoList;
  locked: boolean;
  onSave: (fields: Record<string, unknown>) => void;
  onDelete: () => void;
  onLatest: () => void;
  onSubtask: (title: string, done: () => void) => void;
  onMove: (direction: number) => void;
}) {
  const theme = useContext(Theme);
  const [title, setTitle] = useState(edit.task.title),
    [date, setDate] = useState(edit.task.dueDate ?? "");
  const [status, setStatus] = useState(edit.task.status),
    [priority, setPriority] = useState(edit.task.priority);
  const [child, setChild] = useState("");
  const [section, setSection] = useState(edit.task.sectionId ?? "none");
  useEffect(() => {
    setTitle(edit.task.title);
    setDate(edit.task.dueDate ?? "");
    setStatus(edit.task.status);
    setPriority(edit.task.priority);
    setSection(edit.task.sectionId ?? "none");
  }, [edit]);
  const stale = list.version !== edit.version;
  const dateValid = !date || dueDateSchema.safeParse(date).success;
  return (
    <View style={s.stack}>
      <Label muted>{edit.task.key}</Label>
      <Text style={[s.heading, { color: theme.foreground }]}>Task details</Text>
      {stale && (
        <View style={s.feedback}>
          <Label>
            This list changed while you were editing. Your draft is still here.
          </Label>
          <Button
            title="Discard draft and load latest"
            disabled={locked}
            onPress={() =>
              Alert.alert(
                "Load latest task?",
                "Your unsaved task edits will be discarded.",
                [
                  { text: "Keep editing", style: "cancel" },
                  { text: "Load latest", onPress: onLatest },
                ],
              )
            }
          />
        </View>
      )}
      <Field
        label="Task name"
        value={title}
        onChangeText={setTitle}
        maxLength={300}
        editable={!locked && !list.archived}
        multiline
      />
      <Field
        label="Due date (YYYY-MM-DD)"
        value={date}
        onChangeText={setDate}
        maxLength={10}
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
        editable={!locked && !list.archived}
      />
      <View style={s.wrap}>
        <Button
          title="Today"
          disabled={locked}
          onPress={() => setDate(today())}
        />
        <Button
          title="Clear date"
          disabled={locked}
          onPress={() => setDate("")}
        />
      </View>
      {!dateValid && <Label>Choose a valid calendar date.</Label>}
      {list.mode === "work" && (
        <>
          <Choices
            label="Status"
            values={taskStatuses}
            value={status}
            onChange={setStatus}
            labels={statusLabels}
            disabled={locked || list.archived}
          />
          <Choices
            label="Priority"
            values={taskPriorities}
            value={priority}
            onChange={setPriority}
            disabled={locked || list.archived}
          />
        </>
      )}
      {!edit.task.parentTaskId && list.sections.length > 0 && (
        <Choices
          label="Section"
          values={["none", ...list.sections.map((item) => item.id)]}
          value={section}
          onChange={setSection}
          disabled={locked || list.archived}
          labels={Object.fromEntries([
            ["none", "No section"],
            ...list.sections.map((item) => [item.id, item.title]),
          ])}
        />
      )}
      <Button
        primary
        title="Save task"
        disabled={
          locked || list.archived || !title.trim() || !dateValid || stale
        }
        onPress={() =>
          onSave({
            title: title.trim(),
            dueDate: date || null,
            ...(!edit.task.parentTaskId
              ? { sectionId: section === "none" ? null : section }
              : {}),
            ...(list.mode === "work" ? { status, priority } : {}),
          })
        }
      />
      {edit.task.content && (
        <Label muted>
          This task has notes. Read and edit the full notes on the website.
        </Label>
      )}
      <Button
        title="Open full task on website"
        disabled={locked}
        onPress={() => {
          void Linking.openURL(client.origin + edit.task.path).catch(() =>
            Alert.alert("Couldn’t open the website."),
          );
        }}
      />
      {!edit.task.parentTaskId && !list.archived && (
        <>
          <Field
            label="Add a subtask"
            value={child}
            onChangeText={setChild}
            maxLength={300}
            editable={!locked}
          />
          <Button
            title="Add subtask"
            disabled={locked || !child.trim()}
            onPress={() => onSubtask(child.trim(), () => setChild(""))}
          />
        </>
      )}
      <View style={s.wrap}>
        <Button
          title="Move earlier"
          disabled={locked || list.archived || stale}
          onPress={() => onMove(-1)}
        />
        <Button
          title="Move later"
          disabled={locked || list.archived || stale}
          onPress={() => onMove(1)}
        />
      </View>
      <Label muted>
        Move changes the shared manual order. Your saved sorting may display
        tasks differently.
      </Label>
      <Button
        title="Delete task"
        danger
        disabled={locked || list.archived || stale}
        onPress={onDelete}
      />
    </View>
  );
}

function ListSettings({
  list,
  owner,
  locked,
  onSave,
  onDelete,
  onLeave,
}: {
  list: TodoList;
  owner: boolean;
  locked: boolean;
  onSave: (fields: Record<string, unknown>) => void;
  onDelete: () => void;
  onLeave: () => void;
}) {
  const [title, setTitle] = useState(list.title),
    [color, setColor] = useState(list.color);
  const [description, setDescription] = useState(list.description);
  const version = useRef(list.version).current;
  return (
    <View style={s.stack}>
      <Label>List settings</Label>
      {owner ? (
        <>
          {version !== list.version && (
            <Label>
              The list changed. Go back and reopen settings before saving.
            </Label>
          )}
          <Field
            label="List name"
            value={title}
            onChangeText={setTitle}
            maxLength={300}
            editable={!locked}
          />
          <Field
            label="Description"
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={4000}
            editable={!locked}
          />
          <Choices
            label="List color"
            values={listColors}
            value={color}
            onChange={setColor}
            disabled={locked}
            labels={Object.fromEntries(
              listColors.map((c) => [c, listPalette[c].label]),
            )}
          />
          <Button
            primary
            title="Save list"
            disabled={locked || !title.trim() || version !== list.version}
            onPress={() => onSave({ title: title.trim(), color, description })}
          />
          <Button
            title={list.archived ? "Restore list" : "Archive list"}
            disabled={locked}
            onPress={() => onSave({ archived: !list.archived })}
          />
          <Button
            danger
            title="Delete list"
            disabled={locked}
            onPress={onDelete}
          />
        </>
      ) : (
        <>
          <Label>Only the owner can change list settings.</Label>
          <Button
            danger
            title="Leave list"
            disabled={locked}
            onPress={onLeave}
          />
        </>
      )}
    </View>
  );
}

function Sharing({
  list,
  sharing,
  owner,
  locked,
  mutate,
}: {
  list: TodoList;
  sharing: ListSharing;
  owner: boolean;
  locked: boolean;
  mutate: (action: string, fields: Record<string, unknown>) => void;
}) {
  const [email, setEmail] = useState("");
  const stale = sharing.version !== list.version;
  return (
    <View style={s.stack}>
      <Label>Sharing · {list.title}</Label>
      <Label muted>Owner: {sharing.owner.name}</Label>
      {stale && (
        <Label>
          The list changed. Go back and reopen sharing to manage access.
        </Label>
      )}
      {sharing.members.map((member) => (
        <View key={member.id} style={s.stack}>
          <Label>{member.name}</Label>
          {owner && (
            <Button
              title={`Remove ${member.name}`}
              danger
              disabled={locked || stale}
              onPress={() =>
                Alert.alert(
                  "Remove member?",
                  "They’ll lose access to this list.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Remove",
                      style: "destructive",
                      onPress: () =>
                        mutate("removeListMember", { userId: member.id }),
                    },
                  ],
                )
              }
            />
          )}
        </View>
      ))}
      {owner && (
        <>
          <Field
            label="Invite an existing Wuff account"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!locked}
          />
          <Label muted>
            Invitations appear in Wuff and expire after seven days. No email is
            sent.
          </Label>
          <Button
            primary
            title="Invite to list"
            disabled={locked || stale || !email.trim() || list.archived}
            onPress={() => mutate("inviteToList", { email: email.trim() })}
          />
          {sharing.invitations.map((invite) => (
            <View key={invite.id} style={s.stack}>
              <Label>{invite.email} · Pending</Label>
              <Button
                title="Cancel invitation"
                disabled={locked || stale}
                onPress={() =>
                  mutate("cancelInvitation", { invitationId: invite.id })
                }
              />
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  page: {
    padding: 20,
    gap: 20,
    paddingBottom: 60,
    maxWidth: 700,
    width: "100%",
    alignSelf: "center",
  },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  mascot: { width: 64, height: 64, resizeMode: "contain" },
  brand: { fontFamily: "DMSans", fontSize: 24, fontWeight: "700" },
  heading: { fontFamily: "DMSans", fontSize: 30, fontWeight: "700" },
  subheading: { fontFamily: "DMSans", fontSize: 20, fontWeight: "600" },
  text: { fontFamily: "DMSans", fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: "DMSans", fontSize: 13, lineHeight: 20 },
  grow: { flex: 1 },
  stack: { gap: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: {
    minHeight: 48,
    minWidth: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  field: { gap: 6 },
  input: {
    fontFamily: "DMSans",
    fontSize: 16,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  listCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  check: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  taskName: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 4,
    justifyContent: "center",
  },
  taskBlock: { gap: 8 },
  child: { marginLeft: 28 },
  feedback: { gap: 10, paddingVertical: 8 },
});
