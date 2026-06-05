/**
 * Login.tsx
 * OAuth login page. Offers Google and GitHub sign-in options.
 * No password fields — OAuth only.
 */

// File: silkllm-frontend/src/pages/auth/Login.tsx

import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Github } from "lucide-react";
import { authApi } from "@/services/api";

// Google SVG icon
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.548 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

export default function Login() {
  return (
    <div className="min-h-screen bg-deep-charcoal flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="font-display font-bold text-3xl text-silk-gold">SilkLLM</Link>
          <p className="text-warm-grey mt-2">Sign in to your account</p>
        </div>

        {/* Auth card */}
        <div className="card bg-slate-dark border-muted-metal">
          <h1 className="text-xl font-semibold text-cloud-grey mb-6 text-center">Welcome back</h1>

          <div className="space-y-3">
            {/* Google */}
            <button
              onClick={() => authApi.googleLogin()}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg
                         bg-white hover:bg-gray-100 text-gray-900 font-medium transition-colors
                         min-h-[44px]"
            >
              <GoogleIcon />
              Continue with Google
            </button>

            {/* GitHub */}
            <button
              onClick={() => authApi.githubLogin()}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg
                         bg-gray-900 hover:bg-gray-800 text-white font-medium border border-muted-metal
                         transition-colors min-h-[44px]"
            >
              <Github size={18} />
              Continue with GitHub
            </button>
          </div>

          <p className="text-warm-grey text-xs text-center mt-6 leading-relaxed">
            By signing in, you agree to our terms of service.
            No password required - OAuth only.
          </p>
        </div>

        <p className="text-center text-warm-grey text-sm mt-6">
          <Link to="/" className="hover:text-silk-gold transition-colors">← Back to home</Link>
        </p>
      </motion.div>
    </div>
  );
}

// EOF silkllm-frontend/src/pages/auth/Login.tsx
