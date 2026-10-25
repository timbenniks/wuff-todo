import type { App } from "@modelcontextprotocol/ext-apps";
export class ToolError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}
export type McpViewRuntime = {
  callServerTool: App["callServerTool"];
  root: HTMLElement;
  status: HTMLElement;
  readonly webOrigin: string;
  request: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  call: (name: string, args: Record<string, unknown>) => Promise<void>;
  show: (data: unknown) => void;
};
export type McpView = {
  matches: (value: Record<string, unknown>) => boolean;
  render: (value: Record<string, unknown>) => void;
  beforeShow?: (value: Record<string, unknown>) => void;
};
