import React, { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ShieldCheck, CheckCircle2, HelpCircle, ArrowRight } from 'lucide-react';
import { db } from '../lib/firebase.ts';
import { generateSafeId } from '../lib/utils.ts';

export function HowItWorksPage({ navigate }: { navigate: (to: string) => void }) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-12">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#132238]">
          How ServiceConnect Works
        </h1>
        <p className="mt-3 text-base text-[#667085] leading-relaxed">
          Whether you need an urgent plumbing repair in Westlands or a full apartment repaint in Mombasa, ServiceConnect gives you a structured, transparent way to hire local professionals.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            step: '01',
            title: 'Search or Describe Your Job',
            desc: 'Browse 16 service categories, filter by neighborhood and price, or describe your problem in plain language using Smart Search.',
          },
          {
            step: '02',
            title: 'Compare Verified Profiles & Quotes',
            desc: 'Review verified identity and credential status, transparent starting rates in KSh, and real reviews from completed bookings.',
          },
          {
            step: '03',
            title: 'Book, Track & Review',
            desc: 'Pick an available time slot, chat directly with your provider inside the booking thread, and submit a verified review after completion.',
          },
        ].map((item) => (
          <div key={item.step} className="bg-white border border-[#E6EAF0] rounded-2xl p-6 space-y-3">
            <div className="font-mono-num text-xs font-bold text-[#0D9488]">{item.step}</div>
            <h2 className="font-display text-lg font-bold text-[#132238]">{item.title}</h2>
            <p className="text-sm text-[#667085] leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#E6EAF0] rounded-2xl p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-bold text-[#132238]">Ready to find a professional?</h3>
          <p className="text-sm text-[#667085] mt-1">Explore active service listings in your city.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/services')}
          className="px-5 py-2.5 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E] inline-flex items-center gap-2"
        >
          Explore Services
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function BecomeProviderPage({ navigate }: { navigate: (to: string) => void }) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-12">
      <div className="bg-[#132238] text-white rounded-2xl p-8 sm:p-12 space-y-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#E6F6F3]">
          For Tradespeople, Technicians & Registered Businesses
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold max-w-2xl">
          Grow Your Business with ServiceConnect.
        </h1>
        <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
          Receive direct bookings and structured quotation requests from customers across Nairobi, Mombasa, Kisumu, Nakuru, and Eldoret. Manage your schedule, prices, and customer messages in one dashboard.
        </p>
        <div className="pt-2 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate('/register?role=provider')}
            className="px-6 py-3 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E]"
          >
            Create Provider Account
          </button>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="px-6 py-3 rounded-lg border border-white/25 text-white text-sm font-semibold hover:bg-white/10"
          >
            Sign In to Dashboard
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            title: 'Step 1: Register & Save Progress',
            desc: 'Set up your personal or business profile, service areas, and working hours. Save incomplete onboarding and return anytime.',
          },
          {
            title: 'Step 2: Submit Verification',
            desc: 'Submit your national ID details, business registration (if applicable), and trade certificates for administrator review.',
          },
          {
            title: 'Step 3: Publish Services & Quote',
            desc: 'List fixed-price, starting-price, hourly, or custom quotation services in KSh and respond to customer requests.',
          },
        ].map((s) => (
          <div key={s.title} className="bg-white border border-[#E6EAF0] rounded-2xl p-6 space-y-2">
            <ShieldCheck className="w-5 h-5 text-[#0D9488]" />
            <h2 className="font-display text-base font-bold text-[#132238]">{s.title}</h2>
            <p className="text-sm text-[#667085] leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AboutPage({ navigate }: { navigate: (to: string) => void }) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-8">
      <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#132238]">
        About ServiceConnect
      </h1>
      <p className="text-base text-[#667085] leading-relaxed">
        ServiceConnect was designed with a clear mission: making it easy for anyone to find, compare, book, and work with reliable local service professionals.
      </p>
      <div className="bg-white border border-[#E6EAF0] rounded-2xl p-8 space-y-4 text-sm text-[#182230] leading-relaxed">
        <p>
          Launching across Kenya—beginning with Nairobi, Mombasa, Kisumu, Nakuru, Eldoret, and Thika—ServiceConnect is architected with configurable currencies, timezones, and neighborhood structures to expand across Uganda, Tanzania, Rwanda, Ghana, Nigeria, and international markets.
        </p>
        <p>
          Unlike informal classified boards, ServiceConnect enforces manual administrator verification of provider credentials, private address protection, structured quotation workflows, and verified booking reviews tied exclusively to completed jobs.
        </p>
      </div>
      <button
        type="button"
        onClick={() => navigate('/contact')}
        className="px-5 py-2.5 rounded-lg bg-[#132238] text-white text-sm font-semibold"
      >
        Contact Our Team
      </button>
    </div>
  );
}

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      await setDoc(doc(db, 'contact_messages', generateSafeId('msg')), {
        name: name.trim().slice(0, 120),
        email: email.trim().slice(0, 254),
        subject: subject.trim().slice(0, 160),
        message: message.trim().slice(0, 2000),
        createdAt: serverTimestamp(),
      });
      setStatus('sent');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-[#132238]">Contact ServiceConnect</h1>
        <p className="text-sm text-[#667085] mt-2">
          Questions about bookings, provider verification, or enterprise partnerships? Send us a message.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-[#E6EAF0] rounded-2xl p-6 sm:p-8 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#182230] mb-1.5">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm focus:outline-none focus:border-[#0D9488]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#182230] mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm focus:outline-none focus:border-[#0D9488]"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#182230] mb-1.5">Subject</label>
          <input
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm focus:outline-none focus:border-[#0D9488]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#182230] mb-1.5">Message</label>
          <textarea
            required
            rows={4}
            minLength={10}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm focus:outline-none focus:border-[#0D9488]"
          />
        </div>
        <button
          type="submit"
          disabled={status === 'sending'}
          className="px-6 py-2.5 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E] disabled:opacity-50"
        >
          {status === 'sending' ? 'Sending...' : 'Send Message'}
        </button>
        {status === 'sent' && (
          <p className="text-xs text-[#16A36A] flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Message received by the ServiceConnect support team.
          </p>
        )}
        {status === 'error' && (
          <p className="text-xs text-[#DC5353]">Please enter a message of at least 10 characters and try again.</p>
        )}
      </form>
    </div>
  );
}

export function HelpPage({ navigate }: { navigate: (to: string) => void }) {
  const [search, setSearch] = useState('');
  const topics = [
    { title: 'Booking a professional', body: 'Search by category or area, pick an available date and time slot, and submit either a direct booking or quotation request.' },
    { title: 'Understanding quotations', body: 'Providers inspect your job description and send an itemized KSh price and completion estimate. You decide whether to accept or decline.' },
    { title: 'Provider verification process', body: 'Providers upload identity and credential summaries in their dashboard. Administrators review submissions manually before issuing badges.' },
    { title: 'Reporting a dispute', body: 'If a confirmed or in-progress job encounters an issue, open a dispute directly from your booking details for administrator mediation.' },
  ].filter((t) => !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.body.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-8">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold text-[#132238]">Help Center</h1>
        <p className="text-sm text-[#667085]">Search marketplace guides or contact support.</p>
      </div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search help topics..."
        className="w-full px-4 py-3 rounded-xl border border-[#E6EAF0] bg-white text-sm focus:outline-none focus:border-[#0D9488]"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {topics.map((t) => (
          <div key={t.title} className="bg-white border border-[#E6EAF0] rounded-2xl p-6 space-y-2">
            <HelpCircle className="w-5 h-5 text-[#0D9488]" />
            <h2 className="font-display text-base font-bold text-[#132238]">{t.title}</h2>
            <p className="text-sm text-[#667085] leading-relaxed">{t.body}</p>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => navigate('/contact')}
        className="px-5 py-2.5 rounded-lg border border-[#E6EAF0] bg-white text-sm font-semibold text-[#132238]"
      >
        Still need help? Contact Support
      </button>
    </div>
  );
}

export function LegalPage({ type }: { type: 'privacy' | 'terms' }) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-6">
      <h1 className="font-display text-3xl font-bold text-[#132238]">
        {type === 'privacy' ? 'Privacy Policy & Data Protection' : 'Terms of Service'}
      </h1>
      <div className="bg-white border border-[#E6EAF0] rounded-2xl p-8 space-y-4 text-sm text-[#182230] leading-relaxed">
        {type === 'privacy' ? (
          <>
            <p>
              ServiceConnect processes personal data in alignment with the Kenya Data Protection Act, 2019 and applicable international standards.
            </p>
            <p>
              <strong>PII Isolation:</strong> Customer phone numbers, email addresses, and saved street addresses are isolated to your private account and only shared with an assigned provider when required to fulfill a booking.
            </p>
            <p>
              <strong>Verification Documents:</strong> Provider identification and business registration records are stored under restricted access rules visible only to the provider and authorized administrators.
            </p>
            <p>
              <strong>Consent & Deletion:</strong> You can update notification preferences or request permanent account deletion directly inside your Account Settings.
            </p>
          </>
        ) : (
          <>
            <p>
              ServiceConnect operates as a local services marketplace connecting customers with independent professionals and registered service businesses.
            </p>
            <p>
              <strong>Bookings & Quotations:</strong> Direct bookings reflect listed provider rates; custom quotations require customer approval before confirmation.
            </p>
            <p>
              <strong>Reviews & Moderation:</strong> Only customers with completed bookings may submit verified reviews. Fraudulent listings, harassment, or policy violations may result in account suspension.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
