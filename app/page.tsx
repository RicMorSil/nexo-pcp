"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Algorithm = "FIFO" | "SPT" | "EDD" | "CR";
type View = "dashboard" | "orders" | "machines" | "comparison" | "settings";

type Machine = {
  id: string;
  name: string;
  capacity: number;
  color: string;
};

type Order = {
  id: string;
  product: string;
  customer: string;
  quantity: number;
  duration: number;
  dueDate: string;
  priority: number;
  machineId: string;
  createdAt: string;
};

type ScheduledOrder = Order & {
  start: number;
  completion: number;
  dueHours: number;
  tardiness: number;
  machine: Machine;
};

type ScheduleResult = {
  algorithm: Algorithm;
  scheduled: ScheduledOrder[];
  tardyCount: number;
  tardyHours: number;
  avgFlow: number;
  makespan: number;
  score: number;
};

const DAY = 86_400_000;
const STORAGE_KEY = "nexo-pcp-v1";
const algorithmInfo: Record<Algorithm, { name: string; description: string }> = {
  FIFO: { name: "FIFO", description: "Primeira ordem cadastrada, primeira a produzir" },
  SPT: { name: "SPT", description: "Menor tempo de processamento primeiro" },
  EDD: { name: "EDD", description: "Menor prazo de entrega primeiro" },
  CR: { name: "Razão Crítica", description: "Equilibra prazo restante e tempo de produção" },
};

function isoOffset(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const demoMachines: Machine[] = [
  { id: "m-a1", name: "Bambu Lab A1", capacity: 16, color: "#3154d6" },
  { id: "m-mini", name: "Bambu Lab A1 Mini", capacity: 14, color: "#0f9c83" },
];

function makeDemoOrders(): Order[] {
  return [
    { id: "OP-1042", product: "Suporte para Kindle", customer: "Pedido online", quantity: 4, duration: 12, dueDate: isoOffset(2), priority: 3, machineId: "m-a1", createdAt: isoOffset(-3) },
    { id: "OP-1043", product: "Chaveiros NFC", customer: "Loja Aurora", quantity: 30, duration: 18, dueDate: isoOffset(4), priority: 2, machineId: "m-a1", createdAt: isoOffset(-2) },
    { id: "OP-1044", product: "Organizador modular", customer: "Mariana S.", quantity: 6, duration: 9, dueDate: isoOffset(1), priority: 3, machineId: "m-mini", createdAt: isoOffset(-2) },
    { id: "OP-1045", product: "Porta-celular gamer", customer: "Estoque da loja", quantity: 12, duration: 15, dueDate: isoOffset(5), priority: 1, machineId: "m-mini", createdAt: isoOffset(-1) },
    { id: "OP-1046", product: "Kit lembrancinhas", customer: "Evento Camila", quantity: 40, duration: 26, dueDate: isoOffset(3), priority: 3, machineId: "m-a1", createdAt: isoOffset(0) },
    { id: "OP-1047", product: "Bandeja personalizada", customer: "Pedido direto", quantity: 3, duration: 7, dueDate: isoOffset(2), priority: 2, machineId: "m-mini", createdAt: isoOffset(0) },
  ];
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" })
    .format(new Date(`${value}T12:00:00`))
    .replace(".", "");
}

function dateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    .format(new Date(`${value}T12:00:00`));
}

function dueInWorkingHours(dueDate: string, capacity: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  const days = Math.max(1, Math.floor((due.getTime() - today.getTime()) / DAY) + 1);
  return days * capacity;
}

function sequenceOrders(orders: Order[], machine: Machine, algorithm: Algorithm) {
  const remaining = [...orders];
  const result: Order[] = [];
  let elapsed = 0;
  const priorityTie = (a: Order, b: Order) => b.priority - a.priority || a.id.localeCompare(b.id);

  while (remaining.length) {
    remaining.sort((a, b) => {
      if (algorithm === "FIFO") {
        return a.createdAt.localeCompare(b.createdAt) || priorityTie(a, b);
      }
      if (algorithm === "SPT") {
        return a.duration - b.duration || priorityTie(a, b);
      }
      if (algorithm === "EDD") {
        return a.dueDate.localeCompare(b.dueDate) || priorityTie(a, b);
      }
      const ratioA = (dueInWorkingHours(a.dueDate, machine.capacity) - elapsed) / a.duration;
      const ratioB = (dueInWorkingHours(b.dueDate, machine.capacity) - elapsed) / b.duration;
      return ratioA - ratioB || priorityTie(a, b);
    });
    const next = remaining.shift()!;
    result.push(next);
    elapsed += next.duration;
  }
  return result;
}

function buildSchedule(orders: Order[], machines: Machine[], algorithm: Algorithm): ScheduleResult {
  const scheduled: ScheduledOrder[] = [];

  machines.forEach((machine) => {
    const machineOrders = sequenceOrders(
      orders.filter((order) => order.machineId === machine.id),
      machine,
      algorithm,
    );
    let elapsed = 0;
    machineOrders.forEach((order) => {
      const dueHours = dueInWorkingHours(order.dueDate, machine.capacity);
      const completion = elapsed + order.duration;
      scheduled.push({
        ...order,
        start: elapsed,
        completion,
        dueHours,
        tardiness: Math.max(0, completion - dueHours),
        machine,
      });
      elapsed = completion;
    });
  });

  const tardyHours = scheduled.reduce((sum, order) => sum + order.tardiness, 0);
  const tardyCount = scheduled.filter((order) => order.tardiness > 0).length;
  const avgFlow = scheduled.length
    ? scheduled.reduce((sum, order) => sum + order.completion, 0) / scheduled.length
    : 0;
  const makespan = Math.max(0, ...machines.map((machine) =>
    scheduled.filter((order) => order.machineId === machine.id).reduce((sum, order) => sum + order.duration, 0),
  ));

  return {
    algorithm,
    scheduled,
    tardyHours,
    tardyCount,
    avgFlow,
    makespan,
    score: tardyHours * 1000 + tardyCount * 300 + avgFlow,
  };
}

function hours(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`;
}

function riskFor(order: ScheduledOrder) {
  if (order.tardiness > 0) return { label: "Atraso previsto", className: "danger" };
  const slack = order.dueHours - order.completion;
  if (slack < order.machine.capacity * 0.5) return { label: "Atenção", className: "warning" };
  return { label: "No prazo", className: "success" };
}

export default function Home() {
  const [machines, setMachines] = useState<Machine[]>(demoMachines);
  const [orders, setOrders] = useState<Order[]>(makeDemoOrders);
  const [algorithm, setAlgorithm] = useState<Algorithm>("EDD");
  const [view, setView] = useState<View>("dashboard");
  const [ready, setReady] = useState(false);
  const [orderModal, setOrderModal] = useState(false);
  const [machineModal, setMachineModal] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { machines: Machine[]; orders: Order[] };
        if (parsed.machines?.length) setMachines(parsed.machines);
        if (Array.isArray(parsed.orders)) setOrders(parsed.orders);
      }
    } catch {
      // Mantém os dados demonstrativos se o armazenamento não estiver disponível.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ machines, orders }));
  }, [machines, orders, ready]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const comparisons = useMemo(
    () => (["FIFO", "SPT", "EDD", "CR"] as Algorithm[])
      .map((item) => buildSchedule(orders, machines, item))
      .sort((a, b) => a.score - b.score),
    [orders, machines],
  );
  const suggested = comparisons[0];
  const selected = useMemo(
    () => buildSchedule(orders, machines, algorithm),
    [orders, machines, algorithm],
  );
  const totalHours = orders.reduce((sum, order) => sum + order.duration, 0);
  const riskOrders = selected.scheduled.filter((order) => riskFor(order).className !== "success");

  function notify(message: string) {
    setToast(message);
  }

  function addOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const numericIds = orders
      .map((order) => Number(order.id.replace(/\D/g, "")))
      .filter(Number.isFinite);
    const nextId = `OP-${Math.max(1000, ...numericIds) + 1}`;
    const newOrder: Order = {
      id: nextId,
      product: String(form.get("product") || "Nova ordem"),
      customer: String(form.get("customer") || "Não informado"),
      quantity: Number(form.get("quantity")) || 1,
      duration: Math.max(0.5, Number(form.get("duration")) || 1),
      dueDate: String(form.get("dueDate")),
      priority: Number(form.get("priority")) || 2,
      machineId: String(form.get("machineId")),
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setOrders((current) => [...current, newOrder]);
    setOrderModal(false);
    setView("orders");
    notify(`${nextId} adicionada ao planejamento`);
  }

  function addMachine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "Nova máquina");
    setMachines((current) => [
      ...current,
      {
        id: `m-${Date.now()}`,
        name,
        capacity: Math.max(1, Number(form.get("capacity")) || 8),
        color: String(form.get("color") || "#3154d6"),
      },
    ]);
    setMachineModal(false);
    setView("machines");
    notify(`${name} adicionada`);
  }

  function removeOrder(id: string) {
    setOrders((current) => current.filter((order) => order.id !== id));
    notify(`${id} removida do planejamento`);
  }

  function removeMachine(id: string) {
    if (orders.some((order) => order.machineId === id)) {
      notify("Remova ou redistribua as ordens dessa máquina primeiro");
      return;
    }
    setMachines((current) => current.filter((machine) => machine.id !== id));
    notify("Máquina removida");
  }

  function applySuggestion() {
    setAlgorithm(suggested.algorithm);
    setView("dashboard");
    notify(`${algorithmInfo[suggested.algorithm].name} aplicado ao planejamento`);
  }

  function exportCsv() {
    const header = ["Ordem", "Produto", "Cliente", "Quantidade", "Máquina", "Duração (h)", "Entrega", "Prioridade"];
    const rows = orders.map((order) => {
      const machine = machines.find((item) => item.id === order.machineId)?.name || "";
      return [order.id, order.product, order.customer, order.quantity, machine, order.duration, order.dueDate, order.priority];
    });
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `planejamento-producao-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify("Planilha exportada com sucesso");
  }

  function resetDemo() {
    setMachines(demoMachines);
    setOrders(makeDemoOrders());
    setAlgorithm("EDD");
    notify("Dados de demonstração restaurados");
  }

  const navItems: { id: View; label: string; short: string }[] = [
    { id: "dashboard", label: "Visão geral", short: "01" },
    { id: "orders", label: "Ordens", short: "02" },
    { id: "machines", label: "Máquinas", short: "03" },
    { id: "comparison", label: "Comparação", short: "04" },
    { id: "settings", label: "Configurações", short: "05" },
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("dashboard")} aria-label="Ir para visão geral">
          <span className="brand-mark"><i /><i /><i /></span>
          <span><strong>NEXO</strong><small>PCP</small></span>
        </button>
        <div className="topbar-context">
          <span className="live-dot" />
          <span>Planejamento salvo neste dispositivo</span>
        </div>
        <button className="primary compact" onClick={() => setOrderModal(true)}>
          <span>＋</span> Nova ordem
        </button>
      </header>

      <aside className="sidebar">
        <div className="sidebar-label">PLANEJAMENTO</div>
        <nav aria-label="Navegação principal">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => setView(item.id)}
            >
              <span>{item.short}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="capacity-ring" style={{ "--progress": `${Math.min(100, totalHours / Math.max(1, machines.reduce((sum, item) => sum + item.capacity, 0) * 5) * 100)}%` } as React.CSSProperties}>
            <span>{Math.round(totalHours / Math.max(1, machines.reduce((sum, item) => sum + item.capacity, 0) * 5) * 100)}%</span>
          </div>
          <div><strong>Carga da semana</strong><small>{hours(totalHours)} planejadas</small></div>
        </div>
      </aside>

      <main className="content">
        {view === "dashboard" && (
          <Dashboard
            orders={orders}
            machines={machines}
            comparisons={comparisons}
            selected={selected}
            suggested={suggested}
            algorithm={algorithm}
            setAlgorithm={setAlgorithm}
            riskOrders={riskOrders}
            totalHours={totalHours}
            onAdd={() => setOrderModal(true)}
            onApplySuggestion={applySuggestion}
            onViewComparison={() => setView("comparison")}
          />
        )}
        {view === "orders" && (
          <OrdersView orders={orders} machines={machines} onAdd={() => setOrderModal(true)} onRemove={removeOrder} />
        )}
        {view === "machines" && (
          <MachinesView machines={machines} orders={orders} onAdd={() => setMachineModal(true)} onRemove={removeMachine} />
        )}
        {view === "comparison" && (
          <ComparisonView comparisons={comparisons} suggested={suggested} onApply={applySuggestion} />
        )}
        {view === "settings" && (
          <SettingsView onExport={exportCsv} onReset={resetDemo} orders={orders} machines={machines} />
        )}
      </main>

      {orderModal && <OrderModal machines={machines} onClose={() => setOrderModal(false)} onSubmit={addOrder} />}
      {machineModal && <MachineModal onClose={() => setMachineModal(false)} onSubmit={addMachine} />}
      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </div>
  );
}

function Dashboard({
  orders,
  machines,
  comparisons,
  selected,
  suggested,
  algorithm,
  setAlgorithm,
  riskOrders,
  totalHours,
  onAdd,
  onApplySuggestion,
  onViewComparison,
}: {
  orders: Order[];
  machines: Machine[];
  comparisons: ScheduleResult[];
  selected: ScheduleResult;
  suggested: ScheduleResult;
  algorithm: Algorithm;
  setAlgorithm: (algorithm: Algorithm) => void;
  riskOrders: ScheduledOrder[];
  totalHours: number;
  onAdd: () => void;
  onApplySuggestion: () => void;
  onViewComparison: () => void;
}) {
  return (
    <>
      <section className="hero-row">
        <div>
          <p className="eyebrow">CENTRAL DE PROGRAMAÇÃO</p>
          <h1>Produção no ritmo certo.</h1>
          <p className="hero-copy">Compare regras de sequenciamento, antecipe atrasos e transforme sua fila de pedidos em um plano executável.</p>
        </div>
        <div className="hero-actions">
          <button className="secondary" onClick={onAdd}>Adicionar ordem</button>
          <button className="primary" onClick={onApplySuggestion}>Aplicar melhor sequência <span>→</span></button>
        </div>
      </section>

      <section className="kpi-grid" aria-label="Indicadores do planejamento">
        <Kpi label="Ordens abertas" value={String(orders.length).padStart(2, "0")} detail={`${orders.reduce((sum, item) => sum + item.quantity, 0)} peças no total`} accent="blue" />
        <Kpi label="Carga programada" value={hours(totalHours)} detail={`${machines.length} máquinas disponíveis`} accent="ink" />
        <Kpi label="Risco de atraso" value={String(riskOrders.length).padStart(2, "0")} detail={riskOrders.length ? "Requer atenção no plano atual" : "Todas as ordens no prazo"} accent={riskOrders.length ? "orange" : "green"} />
        <Kpi label="Melhor método" value={algorithmInfo[suggested.algorithm].name} detail={`${hours(suggested.tardyHours)} de atraso projetado`} accent="green" />
      </section>

      <section className="planning-grid">
        <article className="panel gantt-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">SEQUÊNCIA RECOMENDADA</p>
              <h2>Plano por máquina</h2>
            </div>
            <div className="algorithm-select">
              <label htmlFor="algorithm">Método</label>
              <select id="algorithm" value={algorithm} onChange={(event) => setAlgorithm(event.target.value as Algorithm)}>
                {(["FIFO", "SPT", "EDD", "CR"] as Algorithm[]).map((item) => <option key={item} value={item}>{algorithmInfo[item].name}</option>)}
              </select>
            </div>
          </div>

          <div className="method-note">
            <span className={algorithm === suggested.algorithm ? "best" : "neutral"}>{algorithm === suggested.algorithm ? "MELHOR RESULTADO" : "SIMULAÇÃO"}</span>
            <p><strong>{algorithmInfo[algorithm].name}</strong> — {algorithmInfo[algorithm].description}.</p>
          </div>

          <Gantt result={selected} machines={machines} />

          <div className="metric-strip">
            <div><span>ATRASO TOTAL</span><strong>{hours(selected.tardyHours)}</strong></div>
            <div><span>ORDENS EM ATRASO</span><strong>{selected.tardyCount}</strong></div>
            <div><span>FLUXO MÉDIO</span><strong>{hours(selected.avgFlow)}</strong></div>
            <div><span>CONCLUSÃO DO PLANO</span><strong>{hours(selected.makespan)}</strong></div>
          </div>
        </article>

        <article className="panel queue-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">PRIORIDADE OPERACIONAL</p>
              <h2>Próximas ordens</h2>
            </div>
            <span className="count-badge">{selected.scheduled.length}</span>
          </div>
          <div className="queue-list">
            {selected.scheduled
              .sort((a, b) => a.start - b.start || b.priority - a.priority)
              .slice(0, 6)
              .map((order, index) => {
                const risk = riskFor(order);
                return (
                  <div className="queue-item" key={order.id}>
                    <span className="queue-position">{String(index + 1).padStart(2, "0")}</span>
                    <div className="queue-main">
                      <strong>{order.product}</strong>
                      <small>{order.id} · {order.machine.name}</small>
                    </div>
                    <div className="queue-meta">
                      <strong>{hours(order.duration)}</strong>
                      <span className={`status ${risk.className}`}>{risk.label}</span>
                    </div>
                  </div>
                );
              })}
            {!selected.scheduled.length && <Empty title="Nenhuma ordem programada" text="Adicione sua primeira ordem para gerar a sequência." />}
          </div>
        </article>
      </section>

      <section className="panel comparison-preview">
        <div className="panel-head">
          <div>
            <p className="eyebrow">ANÁLISE DE CENÁRIOS</p>
            <h2>O método muda o resultado</h2>
          </div>
          <button className="text-button" onClick={onViewComparison}>Ver comparação completa <span>→</span></button>
        </div>
        <div className="method-cards">
          {comparisons.map((result, index) => (
            <button key={result.algorithm} className={`method-card ${result.algorithm === algorithm ? "selected" : ""}`} onClick={() => setAlgorithm(result.algorithm)}>
              <span className="method-rank">{index === 0 ? "RECOMENDADO" : `CENÁRIO ${index + 1}`}</span>
              <strong>{algorithmInfo[result.algorithm].name}</strong>
              <small>{algorithmInfo[result.algorithm].description}</small>
              <div><span>Atraso</span><b>{hours(result.tardyHours)}</b></div>
              <div><span>Fluxo médio</span><b>{hours(result.avgFlow)}</b></div>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function Gantt({ result, machines }: { result: ScheduleResult; machines: Machine[] }) {
  const widthBase = Math.max(1, result.makespan);
  return (
    <div className="gantt" aria-label="Gráfico de Gantt do planejamento">
      <div className="gantt-scale">
        <span>0h</span><span>{hours(widthBase * 0.25)}</span><span>{hours(widthBase * 0.5)}</span><span>{hours(widthBase * 0.75)}</span><span>{hours(widthBase)}</span>
      </div>
      {machines.map((machine) => {
        const machineOrders = result.scheduled
          .filter((order) => order.machineId === machine.id)
          .sort((a, b) => a.start - b.start);
        return (
          <div className="gantt-row" key={machine.id}>
            <div className="machine-label"><span style={{ background: machine.color }} />{machine.name}<small>{machine.capacity}h/dia</small></div>
            <div className="gantt-track">
              {machineOrders.map((order, index) => (
                <div
                  key={order.id}
                  className={`gantt-bar tone-${index % 4} ${order.tardiness ? "late" : ""}`}
                  style={{ width: `${Math.max(8, order.duration / widthBase * 100)}%`, background: machine.color }}
                  title={`${order.id} · ${order.product} · ${hours(order.duration)}${order.tardiness ? ` · ${hours(order.tardiness)} de atraso` : ""}`}
                >
                  <strong>{order.id}</strong><small>{hours(order.duration)}</small>
                </div>
              ))}
              {!machineOrders.length && <span className="idle-message">Sem ordens atribuídas</span>}
            </div>
          </div>
        );
      })}
      <div className="gantt-legend"><span><i className="legend-normal" /> No prazo</span><span><i className="legend-late" /> Atraso previsto</span></div>
    </div>
  );
}

function Kpi({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: string }) {
  return (
    <article className={`kpi-card accent-${accent}`}>
      <span className="kpi-label">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      <i />
    </article>
  );
}

function OrdersView({ orders, machines, onAdd, onRemove }: { orders: Order[]; machines: Machine[]; onAdd: () => void; onRemove: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const filtered = orders.filter((order) => `${order.id} ${order.product} ${order.customer}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <section className="view-section">
      <ViewHeader eyebrow="CARTEIRA DE PEDIDOS" title="Ordens de produção" description="Cadastre, consulte e organize todas as demandas que entram no seu planejamento." action="Nova ordem" onAction={onAdd} />
      <div className="panel table-panel">
        <div className="table-tools">
          <label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar ordem, produto ou cliente" /></label>
          <span>{filtered.length} de {orders.length} ordens</span>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Ordem</th><th>Produto / cliente</th><th>Máquina</th><th>Qtd.</th><th>Tempo</th><th>Entrega</th><th>Prioridade</th><th /></tr></thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id}>
                  <td><strong className="order-code">{order.id}</strong></td>
                  <td><strong>{order.product}</strong><small>{order.customer}</small></td>
                  <td>{machines.find((machine) => machine.id === order.machineId)?.name || "Não atribuída"}</td>
                  <td>{order.quantity}</td>
                  <td>{hours(order.duration)}</td>
                  <td>{dateTimeLabel(order.dueDate)}</td>
                  <td><span className={`priority p${order.priority}`}>{order.priority === 3 ? "Alta" : order.priority === 2 ? "Média" : "Baixa"}</span></td>
                  <td><button className="icon-button danger-button" onClick={() => onRemove(order.id)} aria-label={`Remover ${order.id}`}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <Empty title="Nenhuma ordem encontrada" text="Tente outro termo ou adicione uma nova ordem." />}
        </div>
      </div>
    </section>
  );
}

function MachinesView({ machines, orders, onAdd, onRemove }: { machines: Machine[]; orders: Order[]; onAdd: () => void; onRemove: (id: string) => void }) {
  return (
    <section className="view-section">
      <ViewHeader eyebrow="RECURSOS PRODUTIVOS" title="Máquinas e capacidade" description="Defina os recursos disponíveis e a capacidade diária usada nas projeções de prazo." action="Adicionar máquina" onAction={onAdd} />
      <div className="machine-grid">
        {machines.map((machine) => {
          const assigned = orders.filter((order) => order.machineId === machine.id);
          const load = assigned.reduce((sum, order) => sum + order.duration, 0);
          return (
            <article className="panel machine-card" key={machine.id}>
              <div className="machine-card-head"><span className="machine-icon" style={{ background: machine.color }}>M</span><button className="icon-button" onClick={() => onRemove(machine.id)} aria-label={`Remover ${machine.name}`}>×</button></div>
              <p className="eyebrow">RECURSO ATIVO</p>
              <h2>{machine.name}</h2>
              <div className="machine-stats"><div><span>Capacidade</span><strong>{machine.capacity}h/dia</strong></div><div><span>Ordens</span><strong>{assigned.length}</strong></div><div><span>Carga</span><strong>{hours(load)}</strong></div></div>
              <div className="load-track"><i style={{ width: `${Math.min(100, load / (machine.capacity * 5) * 100)}%`, background: machine.color }} /></div>
              <small>{Math.round(load / (machine.capacity * 5) * 100)}% da capacidade semanal estimada</small>
            </article>
          );
        })}
        <button className="add-machine-card" onClick={onAdd}><span>＋</span><strong>Adicionar recurso</strong><small>Cadastre uma máquina ou estação de trabalho</small></button>
      </div>
    </section>
  );
}

function ComparisonView({ comparisons, suggested, onApply }: { comparisons: ScheduleResult[]; suggested: ScheduleResult; onApply: () => void }) {
  return (
    <section className="view-section">
      <ViewHeader eyebrow="MOTOR DE DECISÃO" title="Comparação de métodos" description="Os quatro cenários usam as mesmas ordens e máquinas. O melhor resultado prioriza menor atraso total e menor fluxo médio." action="Aplicar recomendado" onAction={onApply} />
      <div className="recommendation panel">
        <div className="recommendation-mark">01</div>
        <div><p className="eyebrow">MELHOR CENÁRIO ENCONTRADO</p><h2>{algorithmInfo[suggested.algorithm].name}</h2><p>{algorithmInfo[suggested.algorithm].description}. Este método gera {hours(suggested.tardyHours)} de atraso total e fluxo médio de {hours(suggested.avgFlow)}.</p></div>
        <span className="recommended-pill">RECOMENDADO</span>
      </div>
      <div className="panel table-panel">
        <div className="comparison-table-head"><p className="eyebrow">RANKING DOS CENÁRIOS</p><span>Menor é melhor ↓</span></div>
        <div className="data-table-wrap">
          <table className="data-table comparison-table">
            <thead><tr><th>Posição</th><th>Método</th><th>Atraso total</th><th>Ordens atrasadas</th><th>Fluxo médio</th><th>Conclusão</th><th>Índice</th></tr></thead>
            <tbody>
              {comparisons.map((result, index) => (
                <tr key={result.algorithm} className={index === 0 ? "best-row" : ""}>
                  <td><span className="rank-number">{String(index + 1).padStart(2, "0")}</span></td>
                  <td><strong>{algorithmInfo[result.algorithm].name}</strong><small>{algorithmInfo[result.algorithm].description}</small></td>
                  <td><strong className={result.tardyHours ? "negative" : "positive"}>{hours(result.tardyHours)}</strong></td>
                  <td>{result.tardyCount}</td>
                  <td>{hours(result.avgFlow)}</td>
                  <td>{hours(result.makespan)}</td>
                  <td><div className="score-bar"><i style={{ width: `${Math.max(8, 100 - (result.score / Math.max(1, comparisons.at(-1)?.score || 1)) * 75)}%` }} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="explain-grid">
        {(["FIFO", "SPT", "EDD", "CR"] as Algorithm[]).map((item) => (
          <article className="explain-card" key={item}><span>{item === "CR" ? "RC" : item}</span><h3>{algorithmInfo[item].name}</h3><p>{item === "FIFO" ? "Simples e previsível. Mantém a ordem de chegada dos pedidos." : item === "SPT" ? "Reduz rapidamente a fila ao concluir primeiro os trabalhos curtos." : item === "EDD" ? "Protege as datas prometidas ao priorizar entregas mais próximas." : "Recalcula a urgência a cada decisão usando prazo disponível e duração."}</p></article>
        ))}
      </div>
    </section>
  );
}

function SettingsView({ onExport, onReset, orders, machines }: { onExport: () => void; onReset: () => void; orders: Order[]; machines: Machine[] }) {
  return (
    <section className="view-section">
      <ViewHeader eyebrow="PREFERÊNCIAS" title="Configurações e dados" description="Gerencie as informações salvas localmente e leve suas ordens para uma planilha quando precisar." />
      <div className="settings-grid">
        <article className="panel settings-card"><span className="settings-icon">CSV</span><div><h2>Exportar planejamento</h2><p>Baixe {orders.length} ordens com produtos, prazos, máquinas e prioridades em formato compatível com Excel.</p></div><button className="secondary" onClick={onExport}>Exportar planilha</button></article>
        <article className="panel settings-card"><span className="settings-icon">↻</span><div><h2>Restaurar demonstração</h2><p>Substitui o planejamento atual pelos exemplos iniciais de duas máquinas e seis ordens.</p></div><button className="secondary danger-outline" onClick={onReset}>Restaurar dados</button></article>
        <article className="panel privacy-card"><p className="eyebrow">PRIVACIDADE</p><h2>Seus dados ficam com você.</h2><p>As {orders.length} ordens e {machines.length} máquinas deste planejamento são mantidas somente neste navegador. Não é necessário criar conta.</p><div className="privacy-line"><span>✓</span> Sem cadastro obrigatório</div><div className="privacy-line"><span>✓</span> Uso individual e imediato</div><div className="privacy-line"><span>✓</span> Exportação a qualquer momento</div></article>
      </div>
    </section>
  );
}

function ViewHeader({ eyebrow, title, description, action, onAction }: { eyebrow: string; title: string; description: string; action?: string; onAction?: () => void }) {
  return (
    <div className="view-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action && <button className="primary" onClick={onAction}>＋ {action}</button>}</div>
  );
}

function OrderModal({ machines, onClose, onSubmit }: { machines: Machine[]; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="modal" onSubmit={onSubmit}>
        <div className="modal-head"><div><p className="eyebrow">NOVA DEMANDA</p><h2>Adicionar ordem de produção</h2></div><button type="button" className="modal-close" onClick={onClose}>×</button></div>
        <div className="form-grid">
          <label className="full">Produto ou serviço<input name="product" required placeholder="Ex.: Suporte personalizado" autoFocus /></label>
          <label className="full">Cliente<input name="customer" required placeholder="Nome ou canal de venda" /></label>
          <label>Quantidade<input name="quantity" type="number" min="1" defaultValue="1" required /></label>
          <label>Tempo total (horas)<input name="duration" type="number" min="0.5" step="0.5" defaultValue="4" required /></label>
          <label>Data de entrega<input name="dueDate" type="date" min={isoOffset(0)} defaultValue={isoOffset(3)} required /></label>
          <label>Prioridade<select name="priority" defaultValue="2"><option value="1">Baixa</option><option value="2">Média</option><option value="3">Alta</option></select></label>
          <label className="full">Máquina<select name="machineId" required defaultValue={machines[0]?.id}>{machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.name} · {machine.capacity}h/dia</option>)}</select></label>
        </div>
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={!machines.length}>Adicionar ao planejamento</button></div>
        {!machines.length && <p className="form-warning">Cadastre uma máquina antes de adicionar ordens.</p>}
      </form>
    </div>
  );
}

function MachineModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="modal small-modal" onSubmit={onSubmit}>
        <div className="modal-head"><div><p className="eyebrow">NOVO RECURSO</p><h2>Adicionar máquina</h2></div><button type="button" className="modal-close" onClick={onClose}>×</button></div>
        <div className="form-grid"><label className="full">Nome da máquina<input name="name" required placeholder="Ex.: Centro de usinagem 01" autoFocus /></label><label>Capacidade diária<input name="capacity" type="number" min="1" max="24" defaultValue="8" required /></label><label>Cor de identificação<input className="color-input" name="color" type="color" defaultValue="#3154d6" /></label></div>
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary">Adicionar máquina</button></div>
      </form>
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="empty"><span>◇</span><strong>{title}</strong><p>{text}</p></div>;
}
