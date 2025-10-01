"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email,setEmail] = useState(""); const [password,setPassword]=useState("");
  const [error,setError] = useState<string|undefined>();

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm border rounded-xl p-6 bg-white">
        <h1 className="text-xl font-semibold mb-4">Sign in</h1>
        {error && <p className="text-red-600 mb-2">{error}</p>}
        <form onSubmit={async e=>{
          e.preventDefault();
          const res = await signIn("credentials",{ email,password, redirect:false });
          if (res?.error) setError("Invalid email or password");
          else window.location.href="/";
        }} className="space-y-3">
          <input className="w-full border rounded px-3 py-2" placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} />
          <input className="w-full border rounded px-3 py-2" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          <button className="w-full rounded bg-black text-white py-2">Sign in</button>
        </form>
      </div>
    </div>
  );
}
