import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Check, Trash2, Trophy, Gift, Users, Sparkles, Info, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "@/lib/notifications.functions";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

const iconFor = (type: string) => {
  switch (type) {
    case "achievement": return Trophy;
    case "reward": return Gift;
    case "referral": return Users;
    case "success": return CheckCircle2;
    case "system": return Sparkles;
    default: return Info;
  }
};

const colorFor = (type: string) => {
  switch (type) {
    case "achievement": return "text-amber-400 bg-amber-500/10";
    case "reward": return "text-pink-400 bg-pink-500/10";
    case "referral": return "text-purple-400 bg-purple-500/10";
    case "success": return "text-emerald-400 bg-emerald-500/10";
    case "system": return "text-sky-400 bg-sky-500/10";
    default: return "text-muted-foreground bg-muted/40";
  }
};

export function NotificationBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listNotifications);
  const readFn = useServerFn(markNotificationRead);
  const allFn = useServerFn(markAllNotificationsRead);
  const delFn = useServerFn(deleteNotification);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
  });

  const items = (data?.items ?? []) as Notif[];
  const unread = data?.unread ?? 0;

  // Realtime updates
  useEffect(() => {
    let userId: string | null = null;
    supabase.auth.getUser().then(({ data }) => {
      userId = data.user?.id ?? null;
      if (!userId) return;
      const channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          () => qc.invalidateQueries({ queryKey: ["notifications"] })
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    });
  }, [qc]);

  const readMut = useMutation({
    mutationFn: (id: string) => readFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const allMut = useMutation({
    mutationFn: () => allFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const handleClick = (n: Notif) => {
    if (!n.read_at) readMut.mutate(n.id);
    if (n.link) navigate({ to: n.link });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={`Notificações${unread > 0 ? ` (${unread} não lidas)` : ""}`}
          className="relative inline-flex min-h-9 min-w-9 items-center justify-center rounded-full border border-border/80 bg-card/60 text-foreground/90 transition hover:border-brand/50 hover:bg-card hover:text-foreground"
        >
          <Bell className="size-4" aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 px-1 text-[10px] font-bold text-white shadow-neon">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-2rem)] max-w-sm p-0 sm:w-96">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notificações</p>
            <p className="text-xs text-muted-foreground">
              {unread > 0 ? `${unread} não lida${unread > 1 ? "s" : ""}` : "Você está em dia"}
            </p>
          </div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => allMut.mutate()}
              disabled={allMut.isPending}
              className="h-8 text-xs"
            >
              <Check className="mr-1 size-3" /> Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
              <Bell className="size-8 opacity-40" />
              <p>Nenhuma notificação por aqui.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {items.map((n) => {
                const Icon = iconFor(n.type);
                const color = colorFor(n.type);
                return (
                  <li key={n.id} className="group relative">
                    <button
                      onClick={() => handleClick(n)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-muted/40 ${!n.read_at ? "bg-purple-500/5" : ""}`}
                    >
                      <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${color}`}>
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className={`truncate text-sm ${!n.read_at ? "font-semibold text-foreground" : "font-medium text-foreground/80"}`}>
                            {n.title}
                          </span>
                          {!n.read_at && <span className="size-1.5 shrink-0 rounded-full bg-purple-500" aria-hidden="true" />}
                        </span>
                        {n.body && (
                          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>
                        )}
                        <span className="mt-1 block text-[11px] text-muted-foreground/70">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); delMut.mutate(n.id); }}
                      aria-label="Remover notificação"
                      className="absolute right-2 top-2 hidden rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-destructive group-hover:block"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
