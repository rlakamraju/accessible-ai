export type Message = { type: string };

export function sendMessage<TResponse = unknown>(message: Message): Promise<TResponse> {
  return chrome.runtime.sendMessage(message);
}
