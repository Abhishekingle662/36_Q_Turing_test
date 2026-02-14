'use client';

import Image from 'next/image';
import {
  ClipboardDocumentListIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  ArrowRightEndOnRectangleIcon,
  CheckBadgeIcon,
  PencilSquareIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 font-sans">
      <div className="max-w-6xl mx-auto">

        {/* HEADER WITH IMAGES */}
        <header className="mb-16">
          <div className="flex items-center justify-between gap-8 mb-12">
            {/* LEFT IMAGE */}
            <div className="hidden lg:block flex-shrink-0">
              <Image
                src="/female.png"
                alt="Female participant"
                width={180}
                height={200}
                className="object-contain"
              />
            </div>

            {/* CENTER TEXT */}
            <div className="text-center flex-grow">
              <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 font-display mb-6">
                Welcome
              </h1>

              <p className="max-w-3xl mx-auto text-lg md:text-xl text-slate-600 leading-relaxed">
                Thank you for participating in this study, part of a project exploring how people connect and build relationships with{' '}
                <strong className="text-slate-900">other people compared to AI</strong>.
              </p>
            </div>

            {/* RIGHT IMAGE */}
            <div className="hidden lg:block flex-shrink-0">
              <Image
                src="/male.png"
                alt="Male participant"
                width={180}
                height={200}
                className="object-contain"
              />
            </div>
          </div>
        </header>

        {/* MAIN GRID */}
        <div className="grid lg:grid-cols-2 gap-10 mb-16">

          {/* LEFT COLUMN */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="flex items-center mb-8">
              <div className="bg-teal-100 text-teal-700 rounded-xl p-3 mr-4">
                <ClipboardDocumentListIcon className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 font-display">
                What will you do?
              </h2>
            </div>

            <div className="space-y-6 text-lg">
              <Step number="1">
                You will start with a <strong>brief pre-conversation survey</strong>.
              </Step>

              <Step number="2">
                You&apos;ll be paired with either a <strong>human partner</strong> or an{' '}
                <strong>AI partner</strong> (an LLM, like ChatGPT) to have a structured conversation.
              </Step>

              <Step number="3">
                After the conversation ends, you&apos;ll complete a{' '}
                <strong>final brief survey</strong>.
              </Step>

              <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-base text-slate-700">
                <strong>Compensation</strong> is provided to participants who complete all parts of the study.
                Participants who fail attention checks or submit fraudulent data will not be compensated.
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="flex items-center mb-8">
              <div className="bg-teal-600 text-white rounded-xl p-3 mr-4">
                <InformationCircleIcon className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 font-display">
                Important Information
              </h2>
            </div>

            <div className="space-y-6">
              <InfoItem
                icon={<ShieldCheckIcon className="w-5 h-5 text-teal-600" />}
                title="Confidentiality"
              >
                Your survey responses and chat transcripts will be stored securely and anonymized.
              </InfoItem>

              <InfoItem
                icon={<ArrowRightEndOnRectangleIcon className="w-5 h-5 text-teal-600" />}
                title="Voluntary Participation"
              >
                You can withdraw from this study at any time.
              </InfoItem>

              <InfoItem
                icon={<CheckBadgeIcon className="w-5 h-5 text-teal-600" />}
                title="Ethics Approval"
              >
                This study has been approved by Indiana University Bloomington&apos;s Institutional Review Board.
              </InfoItem>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-teal-600 rounded-2xl shadow-lg p-10 text-center">
          <h2 className="text-2xl font-bold text-white mb-3 font-display">
            Ready to Begin?
          </h2>
          <p className="text-teal-100 mb-8 text-lg">
            Start your participation in our research study
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => (window.location.href = '/chat')}
              className="bg-white text-teal-700 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-slate-50 transition shadow-md inline-flex items-center gap-2"
            >
              <PencilSquareIcon className="w-5 h-5" />
              Start Conversation
            </button>

            {/* <button
              onClick={() => (window.location.href = '/moderator')}
              className="bg-teal-800 text-white px-6 py-3 rounded-xl font-medium hover:bg-teal-900 transition inline-flex items-center gap-2"
            >
              <UsersIcon className="w-5 h-5" />
              Moderator Access
            </button> */}
          </div>
        </div>

      </div>
    </div>
  );
}

/* ---------- UI HELPERS ---------- */

function Step({
  number,
  children,
}: {
  number: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700 text-sm font-semibold leading-none">
        {number}
      </div>
      <p className="text-slate-700 leading-relaxed">
        {children}
      </p>
    </div>
  );
}

function InfoItem({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-1">{icon}</div>
      <div>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="text-slate-600 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}
