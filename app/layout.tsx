import { Inter } from "next/font/google"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { TooltipProvider } from "@/components/ui/tooltip"
import './globals.css'

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "LinkedIn Post Generator",
  description: "Generate engaging LinkedIn posts using our website content.",
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={cn("flex min-h-svh flex-col antialiased", inter.className)}>
        <TooltipProvider delayDuration={0}>
          {children}
        </TooltipProvider>
      </body>
    </html>
  )
}