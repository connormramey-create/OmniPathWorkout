import { useState } from "react";
import { auth } from "../config/firebase";

export default function AuthModal({ onClose }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (!auth) return setError("Firebase Auth not initialized.");
    const action = isSignUp
      ? auth.createUserWithEmailAndPassword(email, password)
      : auth.signInWithEmailAndPassword(email, password);
    action.then(onClose).catch((err) => setError(err.message));
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-slate-900 border border-slate-800 max-w-sm w-full rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-bold text-amber-400">{isSignUp ? "Create Account" : "User Login"}</h3>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-100" required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-100" required />
          <button type="submit" className="w-full bg-amber-400 text-slate-950 font-bold text-xs py-2 rounded">
            {isSignUp ? "CREATE ACCOUNT" : "LOG IN"}
          </button>
        </form>
        <button onClick={() => setIsSignUp(!isSignUp)} className="text-xs text-slate-400 hover:underline w-full text-center">
          {isSignUp ? "Already have an account? Log In" : "Need an account? Sign Up"}
        </button>
        <button onClick={onClose} className="w-full bg-slate-800 text-slate-400 text-xs py-1.5 rounded">CANCEL</button>
      </div>
    </div>
  );
}
