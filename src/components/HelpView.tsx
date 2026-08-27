import React from 'react';
import { 
  BookOpen, 
  Bookmark, 
  FileText, 
  MessageSquare, 
  Share2, 
  Twitter, 
  Mail, 
  Bug, 
  Lightbulb, 
  FileSpreadsheet, 
  ExternalLink 
} from 'lucide-react';

interface HelpCardItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  link: string;
}

export const HelpView: React.FC = () => {
  const resources: HelpCardItem[] = [
    { id: 'wiki',     icon: <BookOpen size={16} className="text-[#7A9EB0]" />,  title: 'SentryWatch Wiki & FAQ',    desc: 'Search the SentryWatch knowledge base and common question answers.', link: 'https://docs.sentrywatch.local' },
    { id: 'handbook', icon: <Bookmark size={16} className="text-[#C45C5C]" />,  title: 'Security Settings Handbook', desc: 'A reference document of all SentryWatch & SecOps policies.', link: 'https://docs.sentrywatch.local/handbook' },
    { id: 'blog',     icon: <FileText size={16} className="text-[#7A6B99]" />,  title: 'SecOps Threat Intelligence Blog', desc: 'Read our latest threat actor analyses, zero-day CVE advisories, and scanner updates.', link: 'https://blog.sentrywatch.local' },
  ];

  const communities: HelpCardItem[] = [
    { id: 'discord',  icon: <MessageSquare size={16} className="text-[#6A6A99]" />, title: 'Join our SecOps Discord', desc: 'Get fast help from the security community and our automated bot.', link: 'https://discord.gg' },
    { id: 'mastodon', icon: <Share2 size={16} className="text-[#7A9EB0]" />,        title: 'Follow us on Mastodon',   desc: 'Get updates and security research on decentralized social.', link: 'https://mastodon.social' },
    { id: 'twitter',  icon: <Twitter size={16} className="text-[#5A7A8A]" />,       title: 'Follow us on Twitter / X',desc: 'Get immediate announcements and threat intelligence feeds.', link: 'https://x.com' },
    { id: 'email',    icon: <Mail size={16} className="text-[#C4963A]" />,          title: 'Direct Support via Email',desc: 'Reach out to the security engineer team directly for enterprise issues.', link: 'mailto:support@sentrywatch.local' },
  ];

  const reports: HelpCardItem[] = [
    { id: 'bug',      icon: <Bug size={16} className="text-[#9A5A5A]" />,          title: 'Report a Security Bug',    desc: 'Found a vulnerability or crash? Submit a reproduction report safely.', link: 'https://github.com/chx-n/sentrywatch-secops-suite/issues' },
    { id: 'improve',  icon: <Lightbulb size={16} className="text-[#C4963A]" />,    title: 'Suggest an Improvement',   desc: 'Suggest an enhancement or new packet analysis feature for SentryWatch.', link: 'https://github.com/chx-n/sentrywatch-secops-suite/discussions' },
    { id: 'compat',   icon: <FileSpreadsheet size={16} className="text-[#6B8F71]" />,title: 'Make a Compatibility Report', desc: 'Report compatibility with specific Windows versions, VPN clients, or custom firewalls.', link: 'https://github.com/chx-n/sentrywatch-secops-suite/issues' },
  ];

  const renderSection = (title: string, items: HelpCardItem[]) => (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-semibold text-[#E8E6E3]">{title}</h2>
        <div className="flex-1 h-[1px] bg-[#1E1E1E]" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item) => (
          <a
            key={item.id}
            href={item.link}
            target="_blank"
            rel="noreferrer"
            className="p-4 rounded-lg bg-[#111111] border border-[#1E1E1E] hover:bg-[#161616] hover:border-[#2A2A2A] transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {item.icon}
                  <span className="text-xs font-semibold text-[#E8E6E3] group-hover:text-white transition-colors">
                    {item.title}
                  </span>
                </div>
                <ExternalLink size={12} className="text-[#5A5A5A] group-hover:text-[#E8E6E3] transition-colors" />
              </div>

              <p className="text-[11px] text-[#8A8A8A] leading-relaxed">
                {item.desc}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0A0A0A] text-[#E8E6E3] overflow-y-auto p-8 max-w-6xl mx-auto w-full">
      <div className="mb-6 pb-2">
        <h1 className="text-xl font-semibold text-[#E8E6E3]">Get Help & Community</h1>
        <p className="text-xs text-[#5A5A5A] mt-1">Documentation, security guides, and support channels.</p>
      </div>

      {renderSection('Resources', resources)}
      {renderSection('Communities & Support', communities)}
      {renderSection('Make a Report', reports)}
    </div>
  );
};
