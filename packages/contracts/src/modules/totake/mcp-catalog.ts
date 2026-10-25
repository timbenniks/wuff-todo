export const totakeMcpTools = [
  {
    id: "show_totake",
    group: "totake",
    title: "Open Totake",
    scopes: ["totake:read"],
    control: false,
  },
  {
    id: "get_totake_summary",
    group: "totake",
    title: "Read Totake summary",
    scopes: ["totake:read"],
    control: false,
  },
  {
    id: "get_totake",
    group: "totake",
    title: "Read Totake",
    scopes: ["totake:read"],
    control: false,
  },
  {
    id: "update_totake",
    group: "totake",
    title: "Change Totake",
    scopes: ["totake:read", "totake:write"],
    control: false,
  },
] as const;
