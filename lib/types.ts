export type AgentAction =
  | "navigate"
  | "highlight"
  | "open_external"
  | "open_rut"
  | "rut_set_step"
  | "rut_focus_field"
  | "show_checklist"
  | "fill_form"
  | "ask_confirm"
  | "scroll"
  | "go_home"
  | "go_back"
  | "go_forward"
  | "describe";

export interface AgentEvent {
  id: string;
  sessionId: string;
  action: AgentAction;
  target?: string;
  payload?: Record<string, unknown>;
  createdAt: number;
}

export interface AgentActionRequest {
  sessionId: string;
  action: AgentAction;
  target?: string;
  payload?: Record<string, unknown>;
}
