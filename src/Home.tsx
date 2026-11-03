import {
  ArrowRight,
  ArrowDown,
  ArrowLeftRight,
  Banknote,
  Building2,
  ChartNoAxesCombined,
  Check,
  CheckCheck,
  FileText,
  GitCompareArrows,
  History,
  Plus,
  Landmark,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";
import "./home.css";

export default function Home() {
  const entry = "/login";
  const action = "Sign in";
  const features = [
    {
      icon: ArrowLeftRight,
      tone: "blue",
      title: "Every payment channel, together.",
      description:
        "Record cash, bank and mobile money activity in one organised transaction register.",
    },
    {
      icon: FileText,
      tone: "purple",
      title: "A clearer view of what is owed.",
      description:
        "Create customer invoices, allocate partial payments and track outstanding balances.",
    },
    {
      icon: GitCompareArrows,
      tone: "green",
      title: "Match records to evidence.",
      description:
        "Import statements, review exact-match suggestions and investigate unmatched entries.",
    },
    {
      icon: ShieldCheck,
      tone: "amber",
      title: "Give decisions a second pair of eyes.",
      description:
        "Route outgoing payments for independent manager approval, with a reason for each decision.",
    },
    {
      icon: ChartNoAxesCombined,
      tone: "cyan",
      title: "Make your numbers useful.",
      description:
        "Review recorded cash movements and export filtered transaction reports to CSV or PDF.",
    },
    {
      icon: History,
      tone: "slate",
      title: "Keep the story behind the numbers.",
      description:
        "Trace significant actions through audit history and protect completed reporting periods.",
    },
  ];
  return (
    <div className="home-page">
      <a className="home-skip" href="#home-content">
        Skip to content
      </a>
      <header className="home-header">
        <a href="/" className="brand" aria-label="FinBiz 360 home">
          <span className="brand-icon">
            <ChartNoAxesCombined size={24} />
          </span>
          FinBiz <strong>360</strong>
        </a>
        <nav aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#questions">Questions</a>
        </nav>
        <a className="button home-entry small" href={entry}>
          Sign in
          <ArrowRight size={14} />
        </a>
      </header>
      <main className="home-main" id="home-content">
        <section className="home-hero">
          <div className="home-hero-copy">
            <span className="home-eyebrow">
              <span />
              FINBIZ 360 · FINANCIAL WORKSPACE
            </span>
            <h1>
              Your business.
              <br />
              One clear
              <br />
              <span>financial picture.</span>
            </h1>
            <p>
              Bring your transactions, statements and financial decisions
              together. Spend less time piecing records together and more time
              moving your business forward.
            </p>
            <div className="home-hero-actions">
              <a className="button" href={entry}>
                {action}
                <ArrowRight size={17} />
              </a>
              <a className="home-how-link" href="#how-it-works">
                See how it works
                <ArrowDown size={15} />
              </a>
            </div>
            <div className="home-trust">
              <span>
                <Check size={13} />
                Your company records
              </span>
              <span>
                <Check size={13} />
                Clear role permissions
              </span>
              <span>
                <Check size={13} />
                SLE currency
              </span>
            </div>
          </div>
          <div
            className="home-visual"
            aria-label="Workflow: record transactions, review approvals and reconcile statements"
          >
            <span className="home-visual-orbit" aria-hidden="true" />
            <span className="home-visual-sphere" aria-hidden="true" />
            <div className="home-workspace-card">
              <div className="home-window-bar">
                <div>
                  <i />
                  <i />
                  <i />
                </div>
                <span>
                  <LockKeyhole size={11} />
                  Your financial workspace
                </span>
              </div>
              <div className="home-window-heading">
                <span className="home-workspace-mark">
                  <ChartNoAxesCombined size={23} />
                </span>
                <div>
                  <strong>Clarity starts here.</strong>
                  <p>One connected business workflow</p>
                </div>
              </div>
              <div className="home-channel-row">
                <span>
                  <Banknote size={17} />
                  Cash
                </span>
                <span>
                  <Smartphone size={17} />
                  Mobile money
                </span>
                <span>
                  <Landmark size={17} />
                  Bank
                </span>
              </div>
              <div className="home-workflow-preview">
                <div>
                  <span className="home-step-icon">
                    <ArrowLeftRight size={19} />
                  </span>
                  <section>
                    <strong>Record your activity</strong>
                    <p>Receipts, expenses and invoices</p>
                  </section>
                  <span className="home-step-number">01</span>
                </div>
                <div>
                  <span className="home-step-icon">
                    <ShieldCheck size={19} />
                  </span>
                  <section>
                    <strong>Review with confidence</strong>
                    <p>Independent payment approvals</p>
                  </section>
                  <span className="home-step-number">02</span>
                </div>
                <div>
                  <span className="home-step-icon">
                    <CheckCheck size={19} />
                  </span>
                  <section>
                    <strong>Bring records into balance</strong>
                    <p>Statement matching and reporting</p>
                  </section>
                  <span className="home-step-number">03</span>
                </div>
              </div>
              <div className="home-card-footer">
                <span />
                <p>Your own records. No sample financial activity.</p>
              </div>
            </div>
            <div className="home-floating-note">
              <span>
                <GitCompareArrows size={20} />
              </span>
              <div>
                <strong>Evidence meets insight.</strong>
                <p>From transaction to reconciliation.</p>
              </div>
            </div>
          </div>
        </section>
        <section className="home-role-strip" aria-label="Who uses FinBiz 360">
          <span>ONE WORKSPACE FOR YOUR TEAM</span>
          <div>
            <span>
              <Building2 size={15} />
              Management
            </span>
            <span>
              <FileText size={15} />
              Finance
            </span>
            <span>
              <Users size={15} />
              Cashiers
            </span>
            <span>
              <ShieldCheck size={15} />
              Auditors
            </span>
            <span>
              <LockKeyhole size={15} />
              Administrators
            </span>
          </div>
        </section>
        <section className="home-section" id="features">
          <div className="home-section-heading">
            <div>
              <span className="home-eyebrow">
                LESS FRAGMENTATION. MORE CLARITY.
              </span>
              <h2>
                Built around your
                <br />
                everyday financial work.
              </h2>
            </div>
            <p>
              The tools your team needs to record, review and understand the
              business, in one place.
            </p>
          </div>
          <div className="home-feature-grid">
            {features.map(({ icon: Icon, title, description, tone }) => (
              <article className={`effect-card tone-${tone}`} key={title}>
                <span className="home-feature-icon">
                  <Icon size={21} />
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="home-section home-process" id="how-it-works">
          <div className="home-section-heading">
            <div>
              <span className="home-eyebrow">A SIMPLE WAY FORWARD</span>
              <h2>
                From daily records
                <br />
                to informed decisions.
              </h2>
            </div>
            <a href={entry} className="home-how-link">
              Sign in
              <ArrowRight size={15} />
            </a>
          </div>
          <ol className="home-process-grid">
            {[
              [
                "Set up your company",
                "Create owner and administrator accounts, add staff and configure your financial accounts.",
              ],
              [
                "Record and review",
                "Capture receipts and payments, manage invoices and review outgoing expenses.",
              ],
              [
                "Reconcile and understand",
                "Import statements, confirm matches and use reports to review recorded cash movement.",
              ],
            ].map(([title, description], i) => (
              <li key={title}>
                <span>0{i + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="home-section home-faq" id="questions">
          <div>
            <span className="home-eyebrow">A FEW THINGS TO KNOW</span>
            <h2>
              Start with a<br />
              clear understanding.
            </h2>
            <p>FinBiz 360 is your internal financial management workspace.</p>
          </div>
          <div>
            {[
              [
                "Does FinBiz 360 move money?",
                "FinBiz 360 records and reconciles your business activity. It does not hold funds, operate a wallet or initiate bank or mobile money payments.",
              ],
              [
                "Where does the financial data come from?",
                "Your team enters transactions and imports authorized bank or mobile money CSV/XLSX statements. Saved records refresh every 15 seconds while the workspace is visible. Automatic provider feeds are not connected.",
              ],
              [
                "How do other staff get access?",
                "During first-time setup, create separate owner/manager and administrator accounts. The administrator then adds staff accounts with appropriate roles under Settings. Existing companies use sign-in; company registration cannot replace an existing workspace.",
              ],
              [
                "Will I see dummy transactions?",
                "A new company workspace starts empty. Your team adds its own accounts, customers, suppliers and financial records. Optional demo data lives in a separate, clearly labelled workspace.",
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <Plus size={16} aria-hidden="true" />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="home-final-cta">
          <div>
            <span className="home-eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
            <h2>
              Bring your business
              <br />
              into focus.
            </h2>
            <p>A clearer place to start every financial decision.</p>
          </div>
          <a className="button" href={entry}>
            {action}
            <ArrowRight size={17} />
          </a>
        </section>
      </main>
      <footer className="home-footer">
        <a className="brand" href="/">
          <span className="brand-icon">
            <ChartNoAxesCombined size={18} />
          </span>
          FinBiz <strong>360</strong>
        </a>
        <p>Financial clarity for businesses in Sierra Leone.</p>
        <a href={entry}>
          Sign in
          <ArrowRight size={13} />
        </a>
        <span>© {new Date().getFullYear()} FinBiz 360</span>
      </footer>
    </div>
  );
}
