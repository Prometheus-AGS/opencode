import { render, useKeyboard, useRenderer } from "@opentui/solid"
import { For, createSignal, onCleanup, onMount } from "solid-js"

type RuntimeEvent =
  | { type: "ready"; runtime_version: string; session_id: string }
  | { type: "message_started"; message_id: string; role: "assistant" }
  | { type: "text_delta"; message_id: string; text: string }
  | { type: "turn_completed"; message_id: string }
  | { type: "turn_cancelled"; session_id: string }
  | { type: "error"; message: string }

type Message = { id: string; role: "user" | "assistant" | "system"; content: string }

function App() {
  const renderer = useRenderer()
  const [messages, setMessages] = createSignal<Message[]>([
    { id: "welcome", role: "system", content: "Universal Agent Runtime\nOpenTUI client connected to a Rust authority process." },
  ])
  const [sessionId, setSessionId] = createSignal("")
  const [status, setStatus] = createSignal("starting runtime")
  const [busy, setBusy] = createSignal(false)
  let input: { value: string; focus(): void; clear(): void } | undefined

  const binary = process.env.UAR_RUNTIME_BIN ?? "../../target/debug/uar-runtime"
  const child = Bun.spawn([binary], { stdin: "pipe", stdout: "pipe", stderr: "inherit" })

  const send = (value: unknown) => {
    child.stdin.write(`${JSON.stringify(value)}\n`)
    child.stdin.flush()
  }

  void (async () => {
    const reader = child.stdout.getReader()
    const decoder = new TextDecoder()
    let pending = ""
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      pending += decoder.decode(value, { stream: true })
      const lines = pending.split("\n")
      pending = lines.pop() ?? ""
      for (const line of lines) {
        if (!line.trim()) continue
        const event = JSON.parse(line) as RuntimeEvent
        if (event.type === "ready") { setSessionId(event.session_id); setStatus(`ready · runtime ${event.runtime_version}`); input?.focus() }
        if (event.type === "message_started") { setBusy(true); setMessages((m) => [...m, { id: event.message_id, role: "assistant", content: "" }]) }
        if (event.type === "text_delta") setMessages((m) => m.map((x) => x.id === event.message_id ? { ...x, content: x.content + event.text } : x))
        if (event.type === "turn_completed") { setBusy(false); setStatus("ready") }
        if (event.type === "turn_cancelled") { setBusy(false); setStatus("cancelled") }
        if (event.type === "error") { setBusy(false); setStatus(`error · ${event.message}`) }
      }
    }
  })()

  onMount(() => send({ type: "initialize", cwd: process.cwd() }))
  onCleanup(() => send({ type: "shutdown" }))

  const submit = () => {
    const content = input?.value.trim() ?? ""
    if (!content || busy() || !sessionId()) return
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content }])
    input?.clear()
    setStatus("thinking")
    send({ type: "submit_prompt", session_id: sessionId(), content })
  }

  useKeyboard((key) => {
    if (key.name === "escape" && busy()) send({ type: "cancel_turn", session_id: sessionId() })
    if (key.ctrl && key.name === "c") { send({ type: "shutdown" }); renderer.destroy() }
  })

  return (
    <box flexDirection="column" width="100%" height="100%" backgroundColor="#0B0B0D">
      <box height={3} paddingLeft={2} paddingRight={2} justifyContent="space-between" alignItems="center">
        <text fg="#E7E7EA"><strong>prometheus</strong><span fg="#85858F"> / uar</span></text>
        <text fg="#85858F">{status()}</text>
      </box>
      <scrollbox flexGrow={1} paddingLeft={2} paddingRight={2} stickyScroll>
        <box flexDirection="column" gap={1}>
          <For each={messages()}>{(message) => (
            <box flexDirection="column" paddingTop={1} paddingBottom={1}>
              <text fg={message.role === "user" ? "#7AA2F7" : message.role === "system" ? "#85858F" : "#E7E7EA"}>
                <strong>{message.role === "user" ? "you" : message.role === "assistant" ? "prometheus" : message.role}</strong>
              </text>
              <markdown content={message.content || "…"} syntaxStyle="github-dark" />
            </box>
          )}</For>
        </box>
      </scrollbox>
      <box paddingLeft={2} paddingRight={2} paddingBottom={1} flexDirection="column">
        <box backgroundColor="#18181C" paddingLeft={1} paddingRight={1} paddingTop={1} paddingBottom={1}>
          <textarea ref={(el) => { input = el as typeof input }} placeholder={busy() ? "Press Esc to cancel" : "Ask anything…  @ files  / commands  ! shell"} minHeight={1} maxHeight={8} flexGrow={1} onSubmit={submit} focused />
        </box>
        <box height={1} justifyContent="space-between">
          <text fg="#85858F">enter send · shift+enter newline · esc cancel</text>
          <text fg="#85858F">{sessionId().slice(0, 8) || "--------"}</text>
        </box>
      </box>
    </box>
  )
}

await render(() => <App />, { targetFps: 30, exitOnCtrlC: false })
