import React, { useState } from 'react';
import { X } from 'lucide-react';

interface TipsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TIPS = [
  {
    title: 'SentryWatch Tips',
    text: 'Open tips to learn how SentryWatch and the SecOps security engine work.\n\nTips like this one are found throughout the suite. With some tips you can tour an element or a feature, like this:'
  },
  {
    title: 'Live Connection History',
    text: 'The main dashboard charts network traffic from the last 10 minutes. Optionally search all network history data to detect suspicious outbound connections.'
  },
  {
    title: 'SSRF & Safety Guard',
    text: 'By default, the scanner prevents probing private RFC1918 subnets (10.x, 192.168.x) or cloud instance metadata (169.254.169.254) to safeguard your internal network.'
  },
  {
    title: 'Encrypted DNS (DoT)',
    text: 'All outgoing DNS resolution queries are encrypted via DNS-over-TLS (port 853) using Cloudflare & Quad9 securely.'
  }
];

export const TipsModal: React.FC<TipsModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(0);

  if (!isOpen) return null;

  const currentTip = TIPS[step];

  const handleNext = () => {
    if (step < TIPS.length - 1) {
      setStep(step + 1);
    } else {
      setStep(0);
      onClose();
    }
  };

  return (
    <div className="fixed top-14 left-20 z-50 animate-slide-up">
      <div className="w-[300px] bg-[#141414] border border-[#222222] rounded-xl p-4 shadow-2xl text-[#E8E6E3]">
        
        {/* Top bar with Tip tag and close button */}
        <div className="flex items-center justify-between text-[#5A5A5A] mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8A8A8A]">
            Tip ({step + 1}/{TIPS.length})
          </span>
          <button
            onClick={onClose}
            className="hover:text-white transition-colors p-1"
          >
            <X size={14} />
          </button>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-[#E8E6E3] mb-2">
          {currentTip.title}
        </h3>

        {/* Body */}
        <p className="text-[11.5px] text-[#8A8A8A] leading-relaxed whitespace-pre-line mb-4">
          {currentTip.text}
        </p>

        {/* Action Button */}
        <div className="flex justify-end">
          <button
            onClick={handleNext}
            className="px-4 py-1 text-xs rounded-md bg-[#222222] text-[#E8E6E3] hover:bg-[#6B8F71] hover:text-[#0A0A0A] transition-all font-medium"
          >
            {step < TIPS.length - 1 ? 'Next' : 'Got it'}
          </button>
        </div>

      </div>
    </div>
  );
};
