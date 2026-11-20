# assistant

The chat panel of the assistant. The feature has no route: `AssistantPanel` is mounted by
`app/shell/app-frame.tsx` and opened from the command menu.

## Entry points

- `panel/assistant-panel.tsx`: `AssistantPanel`, exported by `index.ts`.
- `panel/use-beside.ts`: `useBeside`, exported by `index.ts`.
- `api.ts`: `assistantKeys`, `chatStateQuery` and `sendMessage`, exported by `index.ts`.

## Endpoints (`api.ts`)

- `GET /assistant/chat`
- `GET /assistant/conversations`
- `GET /assistant/conversations/{id}`
- `DELETE /assistant/conversations/{id}`
- `DELETE /assistant/conversations`
- `POST /assistant/proposals/{id}/confirm`
- `POST /assistant/proposals/{id}/reject`
- `POST /api/v1/assistant/turns` (stream of server-sent events, `sendMessage`)

## Guide topic

`navigation-map.json` lists no screen for the panel. The topic `privacy_and_the_assistant`
belongs to `/settings`.

## Folders

- `panel/`: the panel shell, its aside and drawer layouts, header, composer and its model menu, welcome and notices.
- `conversation/`: the message feed, the conversation list, the pending turn and the turn hook.
- `message/`: one message: the question, the answer, the copy action and the turn activity.
- `proposal/`: the proposal card, its changes, actions, state and screen suggestion.
- `model/`: functions used by two or more folders: `sse`, `mask-amounts`, `catalog-key`, `chat-target` and its hook.
