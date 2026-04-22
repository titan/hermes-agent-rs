# Hook Payload Schema (Plugin Hooks)

This document defines the recommended JSON payload shape for plugin lifecycle hooks in `hermes-agent`.

Validation is **non-blocking** at runtime: mismatches emit a warning but do not stop hook callbacks.

## Hook Payloads

- `pre_tool_call`
  - required: `tool` (string), `turn` (number)
- `post_tool_call`
  - required: `tool` (string), `is_error` (boolean), `turn` (number)
- `pre_llm_call`
  - required: `turn` (number), `model` (string)
- `post_llm_call`
  - required: `turn` (number), `api_time_ms` (number), `has_tool_calls` (boolean)
- `pre_api_request`
  - required: `attempt` (number), `model` (string), `stream` (boolean)
  - optional: `route_label` (string|null)
- `post_api_request`
  - required: `attempt` (number), `model` (string), `stream` (boolean), `ok` (boolean)
  - optional: `finish_reason` (string|null), `error` (string|null), `has_tool_calls` (boolean), `interrupted` (boolean)
- `on_session_start`
  - required: `model` (string)
  - optional: `session_id` (string|null)
- `on_session_end`
  - required: `turns` (number), `finished_naturally` (boolean), `interrupted` (boolean), `session_started_hooks_fired` (boolean)
  - optional: `session_id` (string|null)
- `on_session_finalize`
  - required: `turns` (number), `tool_errors` (number), `session_cost_usd` (number)
  - optional: `session_id` (string|null)
- `on_session_reset`
  - required: `turns` (number), `source` (string)
  - optional: `session_id` (string|null)

## Notes

- Field sets can be extended in future releases.
- Plugin authors should treat unknown fields as forward-compatible and ignore them safely.
