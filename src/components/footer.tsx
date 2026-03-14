import { Heart } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t py-4">
      <div className="container mx-auto flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <span>Powered By Louati Mahdi</span>
        <Heart className="h-4 w-4 text-red-500 animate-heartbeat" />
      </div>
    </footer>
  )
}
