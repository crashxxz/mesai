import { BarChart3, ChefHat, Martini, QrCode, Table2, WalletCards } from "lucide-react";

const guides = [
  { title: "Dono e gerente", icon: BarChart3, steps: ["Cadastre equipe e organize mesas.", "Acompanhe pedidos, caixa e financeiro.", "Atualize o cardápio e a disponibilidade."] },
  { title: "Garçom", icon: Table2, steps: ["Abra a mesa e adicione os itens.", "Envie o pedido e acompanhe o preparo.", "Quando pedirem, encaminhe o fechamento."] },
  { title: "Cozinha", icon: ChefHat, steps: ["Veja os pratos recebidos.", "Marque quando começar o preparo.", "Marque pronto para avisar o atendimento."] },
  { title: "Bar", icon: Martini, steps: ["Veja somente bebidas e itens do bar.", "Separe o pedido.", "Marque pronto quando terminar."] },
  { title: "Caixa", icon: WalletCards, steps: ["Abra o caixa e confira comandas.", "Registre o pagamento.", "Feche a conta e o caixa."] },
  { title: "Cliente pelo QR", icon: QrCode, steps: ["Escaneie o QR e informe a mesa.", "Escolha os itens e envie.", "Chame o garçom ou peça a conta pela tela."] }
];

export default function HelpPage() {
  return <section className="mx-auto grid max-w-5xl gap-4">
    <header><h1 className="text-3xl font-black text-slate-950">Como usar</h1><p className="text-sm font-bold text-slate-500">Passos rápidos para cada função.</p></header>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{guides.map(({ title, icon: Icon, steps }) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"><Icon className="h-7 w-7 text-amber-600" /><h2 className="mt-3 text-lg font-black">{title}</h2><ol className="mt-3 grid gap-2 text-sm font-semibold text-slate-600">{steps.map((step, index) => <li key={step} className="flex gap-2"><span className="font-black text-amber-700">{index + 1}.</span>{step}</li>)}</ol></article>)}</div>
  </section>;
}
