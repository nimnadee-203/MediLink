import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import {
  Activity,
  Stethoscope,
  ClipboardList,
  ArrowRight,
  Shield,
  HeartPulse,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  Search,
  Lock,
  Users,
  FileStack,
  LifeBuoy,
  User
} from 'lucide-react';
import { Card, Button } from '../components/ui';
import { SPECIALITIES } from '../data/mockDoctors';

/** Set to false after you add real photos under client/public/home/ (see ADD_YOUR_IMAGES.txt). */
const USE_HOME_IMAGE_PLACEHOLDERS = false;

const HOME_IMAGES = USE_HOME_IMAGE_PLACEHOLDERS
  ? {
      hero: '/home/hero-placeholder.svg',
      patient: '/home/patient-placeholder.svg',
      scheduling: '/home/feature-scheduling.svg',
      documents: '/home/feature-documents.svg',
      profile: '/home/feature-profile.svg',
      secure: '/home/feature-secure.svg'
    }
  : {
      hero: '/home/hero.jpg',
      patient: '/home/patient.jpg',
      scheduling: '/home/scheduling.jpg',
      documents: '/home/documents.jpg',
      profile: '/home/profile.jpg',
      secure: '/home/secure.jpg'
    };

const footerMuted = 'text-sm text-slate-500 hover:text-blue-700 transition-colors';

/** Public homepage — patient-facing entry. */
export default function HomePage() {
  const navigate = useNavigate();
  const [heroQuery, setHeroQuery] = useState('');
  const year = new Date().getFullYear();

  const onSearch = (e) => {
    e.preventDefault();
    const q = heroQuery.trim();
    navigate(q ? `/doctors?q=${encodeURIComponent(q)}` : '/doctors');
  };

  return (
    <div className="flex flex-col gap-0 -mx-4 md:-mx-10 -mt-2">
      <div className="border-b border-blue-100/80 bg-gradient-to-r from-slate-50 via-blue-50/50 to-indigo-50/40">
        <div className="max-w-6xl mx-auto px-4 md:px-10 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-slate-600">
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" aria-hidden />
            MediSync AI — patient health portal
          </span>
          <span className="inline-flex items-center gap-4">
            <a href="tel:+94115550100" className="inline-flex items-center gap-1 hover:text-blue-700">
              <Phone size={14} /> +94 11 555 0100
            </a>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="hidden sm:inline">Emergency: use national emergency services</span>
          </span>
        </div>
      </div>

      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, rgba(59,130,246,0.35) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(99,102,241,0.25) 0%, transparent 45%)`
          }}
          aria-hidden
        />
        <div className="relative max-w-6xl mx-auto px-4 md:px-10 pt-12 pb-16 md:pt-16 md:pb-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-12 lg:items-center">
            <div className="max-w-3xl lg:max-w-none">
              <p className="text-blue-300 font-semibold text-sm uppercase tracking-widest">Patient portal</p>
              <h1 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight">
                Book care, manage records, and stay on top of your health
              </h1>
              <p className="mt-5 text-lg text-blue-100/90 leading-relaxed">
                Sign in to use your personal dashboard: upload reports, find doctors, and track appointments. MediSync
                centers on the <strong className="text-white font-semibold">patient experience</strong>—clinician and
                administration tools are offered as separate product modules.
              </p>
            </div>
            <div className="relative lg:justify-self-end w-full max-w-xl mx-auto lg:mx-0 lg:max-w-none">
              <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-white/20 bg-white/5 shadow-2xl shadow-black/50 ring-1 ring-white/10">
                <img
                  src={HOME_IMAGES.hero}
                  alt=""
                  className="h-full w-full object-cover"
                  width={1200}
                  height={900}
                  decoding="async"
                />
              </div>
              <p className="mt-2 text-center text-xs text-blue-200/70 lg:text-right">
                Care team &amp; hospital imagery — swap file per ADD_YOUR_IMAGES.txt
              </p>
            </div>
          </div>

          <SignedIn>
            <div className="mt-8 inline-flex flex-wrap items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm text-sm">
              <Lock size={16} className="text-emerald-300 shrink-0" />
              <span className="text-blue-50">Signed in.</span>
              <Link to="/dashboard" className="font-semibold text-white hover:underline">
                Open patient dashboard
              </Link>
              <span className="text-blue-200/60">·</span>
              <Link to="/doctors" className="font-semibold text-white hover:underline">
                Find a doctor
              </Link>
            </div>
          </SignedIn>
          <SignedOut>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signin">
                <Button className="rounded-xl px-6 bg-blue-500 hover:bg-blue-400 text-white border-0 shadow-lg shadow-blue-900/40">
                  Sign in
                  <ArrowRight size={18} />
                </Button>
              </Link>
              <Link to="/signup">
                <Button
                  variant="secondary"
                  className="rounded-xl px-6 bg-white/10 hover:bg-white/15 text-white border border-white/25"
                >
                  Create account
                </Button>
              </Link>
            </div>
          </SignedOut>

          <form
            onSubmit={onSearch}
            className="mt-10 max-w-2xl flex flex-col sm:flex-row gap-3"
            role="search"
            aria-label="Search directory"
          >
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                value={heroQuery}
                onChange={(e) => setHeroQuery(e.target.value)}
                placeholder="Search specialty or location (sign in to open directory)"
                className="w-full rounded-xl border border-white/20 bg-white/95 py-3.5 pl-12 pr-4 text-slate-900 placeholder:text-slate-500 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <Button
              type="submit"
              className="rounded-xl px-8 py-3.5 bg-blue-500 hover:bg-blue-400 text-white border-0 shrink-0"
            >
              Search
            </Button>
          </form>
        </div>
      </section>

      <section className="bg-slate-50 border-y border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 md:px-10 py-14 md:py-16">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">What you can do</h2>
            <p className="mt-3 text-slate-600 leading-relaxed">
              Everything below is available after you sign in as a patient.
            </p>
          </div>

          <div className="max-w-5xl mx-auto grid gap-8 lg:grid-cols-2 lg:gap-10 lg:items-stretch">
            <div className="order-2 lg:order-1 flex flex-col justify-center">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md aspect-[4/3] lg:aspect-auto lg:min-h-[280px]">
                <img
                  src={HOME_IMAGES.patient}
                  alt=""
                  className="h-full w-full object-cover"
                  width={800}
                  height={640}
                  decoding="async"
                />
              </div>
              <p className="mt-2 text-center text-xs text-slate-500 lg:text-left">
                Patient-friendly photo — replace with patient.jpg when ready
              </p>
            </div>
            <Card className="order-1 lg:order-2 p-8 border-slate-200/90 shadow-lg rounded-2xl h-full">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md mx-auto sm:mx-0">
                <Users size={28} />
              </div>
              <h3 className="mt-6 text-xl font-bold text-slate-900 text-center sm:text-left">Patient account</h3>
              <p className="mt-3 text-slate-600 text-sm leading-relaxed text-center sm:text-left">
                One dashboard for documents, booking, and profile settings—aligned with how leading health systems serve
                their members online.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-slate-600">
                <li className="flex gap-2">
                  <ChevronRight size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  Directory search &amp; appointment booking
                </li>
                <li className="flex gap-2">
                  <ChevronRight size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  Report uploads, list, and preview
                </li>
                <li className="flex gap-2">
                  <ChevronRight size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  Profile &amp; appointment history
                </li>
              </ul>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <SignedOut>
                  <Link to="/signin" className="flex-1">
                    <Button className="w-full rounded-xl">Sign in as patient</Button>
                  </Link>
                </SignedOut>
                <SignedIn>
                  <Link to="/dashboard" className="flex-1">
                    <Button className="w-full rounded-xl">Patient dashboard</Button>
                  </Link>
                  <Link to="/doctors" className="flex-1">
                    <Button variant="secondary" className="w-full rounded-xl border-slate-200">
                      <Stethoscope size={18} />
                      Doctors
                    </Button>
                  </Link>
                </SignedIn>
              </div>
            </Card>
          </div>

          <p className="mt-10 text-center text-sm text-slate-500 max-w-2xl mx-auto leading-relaxed border border-dashed border-slate-200 rounded-2xl bg-white/60 px-5 py-4">
            <strong className="text-slate-700">Product focus:</strong> This application delivers the patient journey;
            clinician workspaces and health-system administration are supported through dedicated MediSync modules.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 md:px-10 py-14 md:py-16">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-3">Features</h2>
        <p className="text-center text-slate-600 max-w-2xl mx-auto mb-12 text-sm sm:text-base">
          Core capabilities available through the patient portal.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              icon: ClipboardList,
              title: 'Scheduling',
              desc: 'Book slots, track status, and cancel when allowed.',
              image: HOME_IMAGES.scheduling
            },
            {
              icon: FileStack,
              title: 'Documents',
              desc: 'Upload reports with titles, descriptions, and preview.',
              image: HOME_IMAGES.documents
            },
            {
              icon: User,
              title: 'Profile',
              desc: 'Keep demographics and contact details current.',
              image: HOME_IMAGES.profile
            },
            {
              icon: Shield,
              title: 'Secure access',
              desc: 'Sign-in required; sign out on shared devices.',
              image: HOME_IMAGES.secure
            }
          ].map(({ icon: Icon, title, desc, image }) => (
            <div
              key={title}
              className="group rounded-2xl border border-slate-200 bg-white shadow-sm hover:border-blue-200 hover:shadow-md transition-all overflow-hidden flex flex-col"
            >
              <div className="aspect-[16/10] w-full overflow-hidden bg-slate-100">
                <img
                  src={image}
                  alt=""
                  className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  width={640}
                  height={360}
                  decoding="async"
                />
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Icon size={22} />
                </div>
                <h3 className="mt-4 font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed flex-1">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-blue-600/5 border-y border-blue-100">
        <div className="max-w-6xl mx-auto px-4 md:px-10 py-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Directory specialties</h2>
              <p className="text-sm text-slate-600 mt-1">Categories available in the clinician directory after sign-in.</p>
            </div>
            <SignedIn>
              <Link to="/doctors" className="text-sm font-semibold text-blue-700 inline-flex items-center gap-1">
                Open directory <ArrowRight size={16} />
              </Link>
            </SignedIn>
            <SignedOut>
              <Link to="/signin" className="text-sm font-semibold text-blue-700 inline-flex items-center gap-1">
                Sign in to browse <ArrowRight size={16} />
              </Link>
            </SignedOut>
          </div>
          <div className="flex flex-wrap gap-2">
            {SPECIALITIES.slice(0, 8).map((spec) => (
              <span
                key={spec}
                className="inline-flex rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
              >
                {spec}
              </span>
            ))}
            <span className="inline-flex items-center text-xs text-slate-500 px-2">+ more in app</span>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 md:px-10 pb-14">
        <div className="rounded-3xl bg-gradient-to-r from-blue-700 to-indigo-800 px-8 py-10 md:px-12 md:py-12 text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="flex gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <LifeBuoy size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Help</h2>
              <p className="mt-2 text-blue-100 text-sm leading-relaxed max-w-xl">
                Non-urgent questions only. For emergencies, contact local emergency services.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <a
              href="mailto:support@medisync.example"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-blue-800 hover:bg-blue-50"
            >
              <Mail size={18} />
              Email
            </a>
            <a
              href="tel:+94115550100"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/40 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              <Phone size={18} />
              Call
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-900 text-slate-400">
        <div className="max-w-6xl mx-auto px-4 md:px-10 py-12 md:py-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
            <div>
              <div className="flex items-center gap-2 text-white font-bold text-lg">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <Activity size={20} />
                </span>
                MediSync AI
              </div>
              <p className="mt-4 text-sm leading-relaxed">
                Patient portal for appointments, health records, and profile management.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Patient</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/dashboard" className={footerMuted}>
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link to="/signin" className={footerMuted}>
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link to="/doctors" className={footerMuted}>
                    Find a doctor
                  </Link>
                </li>
                <li>
                  <Link to="/appointments" className={footerMuted}>
                    Appointments
                  </Link>
                </li>
                <li>
                  <Link to="/profile" className={footerMuted}>
                    Profile
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Contact</h4>
              <ul className="space-y-3 text-sm">
                <li className="flex gap-2 items-start">
                  <MapPin size={16} className="shrink-0 mt-0.5" />
                  MediSync Health, Colombo
                </li>
                <li className="flex gap-2 items-center">
                  <Phone size={16} className="shrink-0" />
                  +94 11 555 0100
                </li>
                <li className="flex gap-2 items-center">
                  <Mail size={16} className="shrink-0" />
                  hello@medisync.example
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row sm:justify-between gap-4 text-xs text-slate-500">
            <p>© {year} MediSync AI. All rights reserved.</p>
            <p className="flex items-center gap-2">
              <HeartPulse size={14} className="text-blue-500" />
              <span>Secure patient access</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
