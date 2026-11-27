import { ShieldCheck, Phone, Building2, Award } from 'lucide-react';
import { ProviderProfile } from '../../types/index.ts';

export function VerificationSummary({
  provider,
  compact = false,
}: {
  provider: ProviderProfile;
  compact?: boolean;
}) {
  const isVerified = provider.verificationStatus === 'approved' && provider.identityVerified;

  if (compact) {
    if (!isVerified) {
      return (
        <span className="text-xs text-[#667085]">
          {provider.verificationStatus === 'pending_review'
            ? 'Verification in review'
            : 'Unverified profile'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#16A36A]">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        Verified Pro
      </span>
    );
  }

  const checks = [
    {
      label: 'Identity Verified',
      detail: 'National ID or passport checked by ServiceConnect administrators.',
      active: provider.identityVerified && provider.verificationStatus === 'approved',
      icon: ShieldCheck,
    },
    {
      label: 'Phone Confirmed',
      detail: 'Active Kenyan/regional mobile contact number confirmed.',
      active: provider.phoneVerified,
      icon: Phone,
    },
    {
      label: 'Business Registered',
      detail: 'Business registration certificate reviewed where applicable.',
      active: provider.businessVerified && provider.verificationStatus === 'approved',
      icon: Building2,
    },
    {
      label: 'Credentials Checked',
      detail: 'Trade certificates or technical licenses reviewed by admin team.',
      active: provider.credentialsVerified && provider.verificationStatus === 'approved',
      icon: Award,
    },
  ];

  return (
    <div className="space-y-3">
      {checks.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="flex items-start gap-3">
            <div
              className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                c.active ? 'bg-[#16A36A]/10 text-[#16A36A]' : 'bg-[#F7F9FC] text-[#98A2B3]'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#182230]">
                {c.label}{' '}
                <span className={`text-xs font-medium ${c.active ? 'text-[#16A36A]' : 'text-[#98A2B3]'}`}>
                  · {c.active ? 'Checked' : 'Not verified'}
                </span>
              </div>
              <p className="text-xs text-[#667085] leading-relaxed">{c.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
