'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const stories = [
  'Verified district reporting',
  'Multilingual coverage in English, Urdu, and Hindi',
  'AI-assisted newsroom with human review',
  'Transparent sourcing and editorial checks',
];

export default function HomePage() {
  const [status, setStatus] = useState('Checking Supabase connection...');

  useEffect(() => {
    async function checkSupabase() {
      try {
        const { error } = await supabase.auth.getSession();
        setStatus(
          error ? `Supabase connection issue: ${error.message}` : 'Supabase Auth connected successfully.'
        );
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Supabase connection failed.');
      }
    }

    checkSupabase();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-6 py-20">
        <div className="mb-6 inline-flex w-fit rounded-full border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-cyan-200">
          Kashmir Jammu Information Network
        </div>

        <h1 className="max-w-4xl text-5xl font-black tracking-tight text-white md:text-7xl">
          Trusted journalism for the people of Kashmir and Jammu.
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-slate-300 md:text-xl">
          KJIN brings together verified reporting, public-interest news, multilingual updates, and a rigorous editorial process built for trust.
        </p>

        <div className="mt-8 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-cyan-100">
          <strong>Supabase status:</strong> {status}
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <a
            href="#features"
            className="rounded-full bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Explore platform
          </a>
          <a
            href="#story"
            className="rounded-full border border-slate-700 px-6 py-3 font-semibold text-white transition hover:border-slate-500 hover:bg-slate-900"
          >
            View mission
          </a>
        </div>

        <div id="features" className="mt-16 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stories.map((story) => (
            <div key={story} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-cyan-950/20">
              <div className="mb-3 h-2 w-12 rounded-full bg-cyan-400" />
              <p className="text-base text-slate-200">{story}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="story" className="border-t border-slate-800 bg-slate-900/60">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">Why KJIN</p>
            <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">A platform built around clarity, trust, and accountability.</h2>
          </div>
          <div className="space-y-4 text-slate-300">
            <p>
              KJIN is designed to serve the public with reliable information, transparent sourcing, and editorial discipline. The platform is structured for modern journalism without sacrificing human oversight.
            </p>
            <p>
              From district news to public-interest reporting, every story can move through verification, multilingual translation, review, and publication-ready workflows.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
