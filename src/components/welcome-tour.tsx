import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { completeOnboarding } from "@/lib/user.functions";
import { celebrate } from "@/lib/confetti";
import { Sparkles, Users, Gift, Trophy, Rocket } from "lucide-react";
import { toast } from "sonner";

type Step = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  highlight?: string;
};

const STEPS: Step[] = [
  {
    icon: Rocket,
    title: "Bem-vindo ao KMKZ Streaming! 🎉",
    description:
      "Sua jornada premium começa agora. Em menos de 1 minuto você vai conhecer tudo que preparamos para você aproveitar ao máximo.",
    highlight: "Vamos lá?",
  },
  {
    icon: Sparkles,
    title: "Compartilhe e ganhe pontos",
    description:
      "Compartilhe seu link exclusivo com amigos: cada compartilhamento vale pontos (até 5 por dia) e cada assinatura vale ainda mais.",
    highlight: "Compartilhe todo dia",
  },
  {
    icon: Users,
    title: "Indique amigos e ganhe muito",
    description:
      "Compartilhe seu link exclusivo. A cada amigo que assinar, você acumula pontos e sobe no ranking VIP.",
    highlight: "Quanto mais indicações, mais prêmios",
  },
  {
    icon: Gift,
    title: "Troque pontos por prêmios reais",
    description:
      "Mensalidades grátis, Fire TV Stick, Mi TV Stick e muito mais. Você escolhe como aproveitar seus pontos.",
    highlight: "Catálogo exclusivo",
  },
  {
    icon: Trophy,
    title: "Conquistas e Ranking VIP",
    description:
      "Desbloqueie conquistas, evolua de Bronze até Diamante e apareça no topo do ranking dos assinantes mais engajados.",
    highlight: "Você está pronto!",
  },
];

export function WelcomeTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const completeFn = useServerFn(completeOnboarding);
  const qc = useQueryClient();
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;

  const finish = async () => {
    try {
      await completeFn();
      celebrate();
      qc.invalidateQueries({ queryKey: ["me", "overview"] });
      toast.success("Tudo pronto! Aproveite sua jornada premium ✨");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao finalizar");
    }
  };

  const skip = async () => {
    try {
      await completeFn();
      qc.invalidateQueries({ queryKey: ["me", "overview"] });
    } catch {}
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && skip()}>
      <DialogContent className="sm:max-w-lg border-white/10 bg-slate-950/95 backdrop-blur-xl">
        <div className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-br from-purple-600/20 via-transparent to-pink-600/20" />
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 shadow-lg shadow-purple-500/50">
            <Icon className="h-8 w-8 text-white" />
          </div>
          <DialogTitle className="text-center text-2xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            {current.title}
          </DialogTitle>
          <DialogDescription className="text-center text-base text-slate-300 pt-2">
            {current.description}
          </DialogDescription>
          {current.highlight && (
            <p className="text-center text-sm font-semibold text-pink-400 mt-2">
              {current.highlight}
            </p>
          )}
        </DialogHeader>

        <div className="flex items-center justify-center gap-2 py-4">
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              aria-label={`Ir para passo ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                i === step
                  ? "w-8 bg-gradient-to-r from-purple-500 to-pink-500"
                  : i < step
                    ? "w-2 bg-purple-500/60"
                    : "w-2 bg-white/20"
              }`}
            />
          ))}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
          <Button variant="ghost" onClick={skip} className="text-slate-400">
            Pular tour
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                Voltar
              </Button>
            )}
            {!isLast ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                Próximo
              </Button>
            ) : (
              <Button
                asChild
                onClick={finish}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Link to="/indicacoes">Começar agora</Link>
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
