import { Link } from "react-router-dom";
import Terminal from "../components/Terminal.jsx";

export default function TerminalPage() {
  return (
    <div className="terminal-page">
      <header className="terminal-page-nav" role="banner">
        <Link to="/" className="terminal-page-back">
          ← LILA home
        </Link>
        <span className="terminal-page-label">Neural terminal</span>
      </header>
      <div className="terminal-page-body">
        <Terminal />
      </div>
    </div>
  );
}
