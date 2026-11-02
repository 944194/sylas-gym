
import { Link } from 'react-router-dom';
import { UserRound, ShieldCheck, ArrowRight } from 'lucide-react';
import './LoginSelection.css';

export default function LoginSelection() {
  return (
    <main className="login-selection">
      <div className="login-selection-container">
        <Link to="/" className="login-back">
          ← Back to website
        </Link>

        <p className="login-kicker">AURAFIT MEMBER ACCESS</p>

        <h1>WELCOME TO <span>AURAFIT.</span></h1>

        <p className="login-description">
          Choose your account type to continue.
        </p>

        <div className="login-options">
          <Link to="/client/login" className="login-option">
            <UserRound size={34} />
            <h2>CLIENT LOGIN</h2>
            <p>Access your membership and personal dashboard.</p>
            <span>CONTINUE <ArrowRight size={17} /></span>
          </Link>

          <Link to="/owner/login" className="login-option">
            <ShieldCheck size={34} />
            <h2>OWNER LOGIN</h2>
            <p>Manage clients, memberships and gym operations.</p>
            <span>CONTINUE <ArrowRight size={17} /></span>
          </Link>
        </div>

        <p className="login-register">
          New to AURAFIT? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
