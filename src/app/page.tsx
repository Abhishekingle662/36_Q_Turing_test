'use client';

import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen gradient-bg py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-hero text-shadow mb-6">
            <Image 
              src="/Indiana_Hoosiers_logo.svg" 
              alt="Indiana University Logo" 
              width={40} 
              height={50}
              className="inline-block mr-3"
            />
            Welcome to Our Research Study
          </h1>
          <p className="text-xl leading-relaxed max-w-3xl mx-auto text-shadow">
            Thank you for your interest in participating!
          </p>
          <p className="text-lg leading-relaxed max-w-3xl mx-auto text-shadow mt-4">
            This project is part of an academic research study exploring how people connect and build relationships through conversation.
          </p>
        </div>

        {/* What Will You Do */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="card card-primary animate-slide-in" style={{animationDelay: '0.3s'}}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{backgroundColor: 'var(--primary)'}}>
                <span className="text-white text-lg">🚀</span>
              </div>
              <h2 className="text-section text-emphasis">What Will You Do?</h2>
            </div>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center mt-0.5" style={{backgroundColor: 'var(--primary-light)'}}>
                  <span className="text-xs font-bold text-brand-primary">•</span>
                </div>
                <span className="text-secondary">You'll log in and be paired with another participant.</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center mt-0.5" style={{backgroundColor: 'var(--primary-light)'}}>
                  <span className="text-xs font-bold text-brand-primary">•</span>
                </div>
                <span className="text-secondary">Together, you'll have a conversation in a chat interface.</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center mt-0.5" style={{backgroundColor: 'var(--primary-light)'}}>
                  <span className="text-xs font-bold text-brand-primary">•</span>
                </div>
                <span className="text-secondary">After the conversation, you'll complete a short survey about your experience.</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center mt-0.5" style={{backgroundColor: 'var(--primary-light)'}}>
                  <span className="text-xs font-bold text-brand-primary">•</span>
                </div>
                <span className="text-secondary">Your responses and chat transcript will be stored securely for research purposes.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Important Information */}
        <div className="card card-neutral animate-fade-in mb-12" style={{animationDelay: '0.5s'}}>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">🔒</span>
            <h2 className="text-section text-emphasis">Important Information</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{backgroundColor: 'var(--primary-light)'}}>
                <span className="text-lg">🔐</span>
              </div>
              <h3 className="font-semibold mb-2 text-emphasis">Confidentiality</h3>
              <p className="text-sm text-muted">All responses and chat logs will be stored securely and anonymized.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{backgroundColor: 'var(--primary-light)'}}>
                <span className="text-lg">🚪</span>
              </div>
              <h3 className="font-semibold mb-2 text-emphasis">Voluntary Participation</h3>
              <p className="text-sm text-muted">You can withdraw at any time without penalty.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{backgroundColor: 'var(--primary-light)'}}>
                <span className="text-lg">✓</span>
              </div>
              <h3 className="font-semibold mb-2 text-emphasis">Ethics Approval</h3>
              <p className="text-sm text-muted">This study has been reviewed under university IRB guidelines.</p>
            </div>
          </div>
        </div>

         {/* Call to Action */}
         <div className="text-center card animate-fade-in" style={{animationDelay: '0.6s', background: 'linear-gradient(135deg, var(--primary-light), var(--light-neutral))'}}>
           <div className="mb-8">
             <h2 className="text-lg text-gray-200 mb-6 text-emphasis">
               Ready to participate in our research study? Click below to enter the conversation interface.
             </h2>
           </div>
           <div className="flex justify-center">
             <button 
               className="btn btn-primary group text-xl px-8 py-4"
               onClick={() => window.location.href = '/chat'}
             >
               <span className="text-2xl mr-3">💬</span>
               Start Conversation
               <span className="ml-3 transition-transform group-hover:translate-x-1">→</span>
             </button>
           </div>
         </div>
      </div>
    </div>
  );
}
