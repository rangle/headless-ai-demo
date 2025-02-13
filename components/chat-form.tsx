"use client"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { useChat } from "ai/react"
import { ArrowUpIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AutoResizeTextarea } from "@/components/autoresize-textarea"
import { errorMessages } from "@/lib/errorMessages"

export function ChatForm({ className, ...props }: React.ComponentProps<"form">) {
  const [chatHistory, setChatHistory] = useState<{ role: string, content: string }[]>([]);

  const { messages, input, setInput, append, isLoading, setMessages } = useChat({
    api: "/api/chat",
    onFinish: async (message) => {
      setChatHistory(prev => [
        ...prev,
        { role: 'user', content: input },
        { role: 'assistant', content: message.content }
      ]);
    },
    onError: (error) => {
      const randomErrorMessage =
        errorMessages[Math.floor(Math.random() * errorMessages.length)]
      setMessages([
        ...messages,
        {
          content: `${input}`,
          role: "user",
          id: String(Date.now()),
        },
        {
          content: `${randomErrorMessage || error.message}`,
          role: "assistant",
          id: String(Date.now()),
        }
      ])
    },
  })

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim()) return

    try {
      await append({
        content: input,
        role: "user",
      })
      setInput("")
    } catch (error) {
      console.error("Error sending message:", error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>)
    }
  }

  const header = (
    <header className="m-auto flex max-w-96 flex-col gap-5 text-center">
      <h1 className="text-2xl font-semibold leading-none tracking-tight">LinkedIn Post Generator</h1>
      <p className="text-muted-foreground text-sm">
        Generate engaging LinkedIn posts based on Rangle's website content.
      </p>
      <p className="text-muted-foreground text-sm">Enter a topic related to get started.</p>
    </header>
  )

  const messageList = (
    <div className="my-4 flex h-fit min-h-full flex-col gap-4">
      {messages.map((message, index) => (
        <div
          key={index}
          data-role={message.role}
          className="max-w-[80%] rounded-xl px-3 py-2 text-sm data-[role=assistant]:self-start data-[role=user]:self-end data-[role=assistant]:bg-gray-100 data-[role=user]:bg-blue-500 data-[role=assistant]:text-black data-[role=user]:text-white"
        >
          {message.role === "assistant" ? (
            <>
              {message.content.split("\n\n").map((part, i) => (
                <p key={i} className={i === 0 ? "font-semibold mb-2" : ""}>
                  {part}
                </p>
              ))}
            </>
          ) : (
            message.content
          )}
        </div>
      ))}
    </div>
  )

  return (
    <main
      className={cn(
        "ring-none mx-auto flex h-svh max-h-svh w-full max-w-[35rem] flex-col items-stretch border-none",
        className,
      )}
      {...props}
    >
      <div className="flex-1 content-center overflow-y-auto px-6">{messages.length ? messageList : header}</div>
      <form
        onSubmit={handleSubmit}
        className="border-input bg-background focus-within:ring-ring/10 relative mx-6 mb-6 flex items-center rounded-[16px] border px-3 py-1.5 pr-8 text-sm focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-0"
      >
        <AutoResizeTextarea
          onKeyDown={handleKeyDown}
          onChange={(v) => setInput(v)}
          value={input}
          placeholder={isLoading ? "Searching through website content..." : chatHistory.length < 1 ? "What would you like to post about?" : "Follow-up or refresh the page to clear my head"}
          disabled={isLoading}
          className="placeholder:text-muted-foreground flex-1 bg-transparent focus:outline-none"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="absolute bottom-1 right-1 size-6 rounded-full"
              disabled={isLoading}
            >
              <ArrowUpIcon size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={12}>Submit</TooltipContent>
        </Tooltip>
      </form>
    </main>
  )
}

